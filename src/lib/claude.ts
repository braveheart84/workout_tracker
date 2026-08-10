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

export class ClaudeStructuredOutputError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ClaudeStructuredOutputError";
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
 * for the caller to surface as a retryable error per PRD Section 8.
 */
export async function requestStructuredOutput<T>({
  system,
  prompt,
  schema,
  toolDescription,
  maxTokens = DEFAULT_MAX_TOKENS,
}: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  toolDescription: string;
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getClient();

  const rawSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete rawSchema.$schema;
  const inputSchema = stripUnsupportedStrictKeywords(rawSchema) as Record<
    string,
    unknown
  >;

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
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
    throw new ClaudeStructuredOutputError("Claude API request failed.", {
      cause: error,
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
