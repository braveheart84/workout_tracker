import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// TECH_STACK.md Section 5: a mid-tier Claude model for both text and vision
// calls, kept in one place so it's easy to revisit since every call site
// goes through this same thin wrapper.
const MODEL = "claude-sonnet-5";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 4096;
// PRD Section 8 / TECH_STACK.md Section 5: API calls are wrapped with a
// timeout and a single retry. The SDK's own retry handling already knows
// which errors are safe to retry (connection issues, timeouts, 429, 5xx)
// and backs off between attempts, so it's used here rather than
// reimplementing that classification.
const MAX_RETRIES = 1;

const TOOL_NAME = "return_structured_output";

let client: Anthropic | undefined;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured.");
    }
    client = new Anthropic({
      apiKey,
      timeout: DEFAULT_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    });
  }
  return client;
}

// HTTP statuses the Anthropic API returns for a request that will fail the
// same way every time until an operator fixes something server-side - a bad/
// revoked API key (401), a key without access to the model (403), or (the
// case that prompted this) an account out of credits (400,
// "credit balance too low"). 429 (rate limit) and 5xx are deliberately
// excluded - those are transient/already covered by the SDK's own retry -
// as is a 404, which would only mean a code-level mistake (wrong model id),
// not a per-request condition.
const NON_TRANSIENT_STATUSES = new Set([400, 401, 403]);

export class ClaudeStructuredOutputError extends Error {
  // False for a request that will keep failing the same way until an
  // operator intervenes (bad API key, no credits) - the caller uses this to
  // show the user a message that doesn't imply retrying will help, and to
  // decide whether the failure is alert-worthy.
  readonly isTransient: boolean;

  constructor(
    message: string,
    options?: ErrorOptions & { isTransient?: boolean },
  ) {
    super(message, options);
    this.name = "ClaudeStructuredOutputError";
    this.isTransient = options?.isTransient ?? true;
  }
}

// Claude's `strict: true` tool mode only enforces structural JSON Schema
// keywords (type, properties, required, enum, items, additionalProperties,
// anyOf) - value-range constraints make the request fail outright, e.g.
// "For 'array' type, property 'maxItems' is not supported" and "For
// 'integer' type, properties maximum, minimum are not supported". Strip
// this whole class of keywords recursively from the wire schema; the Zod
// schema itself still enforces them locally via schema.safeParse after the
// call, so nothing is lost - Claude just isn't told about the bounds.
const UNSUPPORTED_STRICT_KEYWORDS = new Set([
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "multipleOf",
]);

function stripUnsupportedStrictKeywords(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripUnsupportedStrictKeywords);
  }
  if (node && typeof node === "object") {
    const entries = Object.entries(node as Record<string, unknown>).filter(
      ([key]) => !UNSUPPORTED_STRICT_KEYWORDS.has(key),
    );
    return Object.fromEntries(
      entries.map(([key, value]) => [
        key,
        stripUnsupportedStrictKeywords(value),
      ]),
    );
  }
  return node;
}

/**
 * Asks Claude to produce output matching `schema`, via tool use (Claude is
 * forced to call a single tool whose input_schema is derived from the Zod
 * schema), and validates the result with that same schema before returning
 * it - per TECH_STACK.md Section 5's "structured output ... validated with
 * Zod" requirement. Throws ClaudeStructuredOutputError on any failure
 * (request failure, missing tool call, or a response that doesn't validate),
 * for the caller to surface as a retryable error per PRD Section 8 - except
 * a request failure classified as non-transient (see NON_TRANSIENT_STATUSES),
 * where the thrown error's isTransient is false so the caller can tell the
 * user retrying won't help instead of suggesting it will.
 *
 * `image`, when passed, is sent alongside the text prompt (PRD 7.7's run
 * screenshot extraction) - TECH_STACK.md Section 5 calls for both the text
 * and vision call sites to go through this one wrapper rather than a
 * separate vision-specific function.
 */
export async function requestStructuredOutput<T>({
  system,
  prompt,
  schema,
  toolDescription,
  maxTokens = DEFAULT_MAX_TOKENS,
  image,
}: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  toolDescription: string;
  maxTokens?: number;
  image?: {
    mediaType: Anthropic.Base64ImageSource["media_type"];
    base64Data: string;
  };
}): Promise<T> {
  const anthropic = getClient();

  const rawSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete rawSchema.$schema;
  const inputSchema = stripUnsupportedStrictKeywords(rawSchema) as Record<
    string,
    unknown
  >;

  const content: Anthropic.MessageParam["content"] = image
    ? [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType,
            data: image.base64Data,
          },
        },
        { type: "text", text: prompt },
      ]
    : prompt;

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      tools: [
        {
          name: TOOL_NAME,
          description: toolDescription,
          input_schema: inputSchema as Anthropic.Tool.InputSchema,
          // Guarantees the API itself enforces the schema (required fields,
          // nullability, array shapes) server-side, rather than relying on
          // the model to freeform-honor it - without this, Claude has been
          // observed omitting required fields or returning null instead of
          // an empty/populated array on some calls, which schema.safeParse
          // below would otherwise be the only thing catching.
          strict: true,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });
  } catch (error) {
    const isNonTransient =
      error instanceof Anthropic.APIError &&
      typeof error.status === "number" &&
      NON_TRANSIENT_STATUSES.has(error.status);

    if (error instanceof Anthropic.APIError && isNonTransient) {
      // Deliberately a distinct, greppable log line rather than folding
      // into the generic error logging each call site already does on its
      // own catch - this is the one signal an operator needs to notice
      // without having to read every generation failure to spot the one
      // that's actually "the app is broken for everyone," not "the model
      // had a bad response."
      console.error(
        "ALERT: Claude API request failed with a non-retryable error " +
          `(status ${error.status}) - this needs operator attention ` +
          "(API key / billing), not a user retry.",
        error,
      );
    }

    throw new ClaudeStructuredOutputError("Claude API request failed.", {
      cause: error,
      isTransient: !isNonTransient,
    });
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new ClaudeStructuredOutputError("Claude did not return a tool call.");
  }

  const parsed = schema.safeParse(toolUse.input);
  if (!parsed.success) {
    // Log the raw payload alongside the validation error - the error alone
    // says which fields were wrong, not what Claude actually sent, which is
    // what's needed to tell a genuine model mistake apart from a bug in our
    // own schema/prompt.
    console.error(
      "Claude tool_use input failed schema validation. Raw input:",
      JSON.stringify(toolUse.input),
    );
    throw new ClaudeStructuredOutputError(
      "Claude's response didn't match the expected shape.",
      { cause: parsed.error },
    );
  }

  return parsed.data;
}
