import { z } from "zod";

/**
 * Agent family. Source: docs/raw/agent.md
 *  - POST /api/v1/agent/fast   (credit cost: 200) — lighter model, low latency.
 *  - POST /api/v1/agent/expert (credit cost: 750) — deeper multi-step analysis.
 *
 * Both endpoints share the same request body and the same
 * `text/event-stream` response shape. The response is NOT a single JSON
 * object — it's a stream of `data: {json}` lines, each one of the four event
 * types below, terminated by a literal `data: [DONE]` sentinel (not a JSON
 * event itself — see AGENT_STREAM_DONE_SENTINEL). Modeled here as one Zod
 * schema per event type plus a discriminated union over `type`, per the
 * task's instructions, rather than a single response object (which would be
 * wrong for an SSE stream).
 */

export const AgentResearchRequest = z.object({
  /** Required, min length 1. Research query or question for the agent. */
  text: z.string().min(1),
  /**
   * Optional. Returned in the `finish` event of a previous response; pass it
   * back to continue that conversation. Omit to start a new conversation.
   */
  conversation_id: z.string().optional(),
});
export type AgentResearchRequest = z.infer<typeof AgentResearchRequest>;

/** Incremental text chunk of the agent's answer. */
export const AgentDeltaEvent = z.object({
  type: z.literal("delta"),
  text: z.string(),
});
export type AgentDeltaEvent = z.infer<typeof AgentDeltaEvent>;

/** Emitted once per unique Nansen tool the agent invokes. */
export const AgentToolCallEvent = z.object({
  type: z.literal("tool_call"),
  name: z.string(),
});
export type AgentToolCallEvent = z.infer<typeof AgentToolCallEvent>;

/**
 * Final event. Contains the conversation_id for follow-up requests and the
 * full list of tools used.
 * TODO: verify against live response — the docs show `tool_calls: [...]`
 * without specifying the item shape; modeled as an array of tool-name
 * strings (matching AgentToolCallEvent.name) since that's the only shape the
 * docs give elsewhere, but it could instead be an array of richer objects.
 */
export const AgentFinishEvent = z.object({
  type: z.literal("finish"),
  conversation_id: z.string(),
  tool_calls: z.array(z.string()),
});
export type AgentFinishEvent = z.infer<typeof AgentFinishEvent>;

/** Emitted if the upstream agent service is unavailable or times out. */
export const AgentErrorEvent = z.object({
  type: z.literal("error"),
  error: z.string(),
  /**
   * TODO: verify against live response — docs show `status_code: …` without
   * stating the type explicitly; modeled as an integer HTTP-style status
   * code by convention with the rest of this API.
   */
  status_code: z.number().int(),
});
export type AgentErrorEvent = z.infer<typeof AgentErrorEvent>;

/** Discriminated union over every SSE JSON event this stream can emit. */
export const AgentStreamEvent = z.discriminatedUnion("type", [
  AgentDeltaEvent,
  AgentToolCallEvent,
  AgentFinishEvent,
  AgentErrorEvent,
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEvent>;

/**
 * Literal sentinel line that terminates the stream: `data: [DONE]`. Not a
 * JSON payload — callers should check for this exact string on the SSE
 * `data:` line before attempting to JSON-parse it as an AgentStreamEvent.
 */
export const AGENT_STREAM_DONE_SENTINEL = "[DONE]";
