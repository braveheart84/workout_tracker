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

  const inputSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete inputSchema.$schema;

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
    throw new ClaudeStructuredOutputError(
      "Claude's response didn't match the expected shape.",
      { cause: parsed.error },
    );
  }

  return parsed.data;
}
