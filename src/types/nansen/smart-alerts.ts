import { z } from "zod";

/**
 * Smart Alerts family. Source: docs/raw/smart-alerts.md
 *  - POST   /api/v1/smart-alert          Create a smart alert
 *  - PATCH  /api/v1/smart-alert          Update a smart alert
 *  - GET    /api/v1/smart-alert/list     List smart alerts
 *  - PATCH  /api/v1/smart-alert/toggle   Enable or disable a smart alert
 *  - DELETE /api/v1/smart-alert/{alert_id}  Delete a smart alert
 *
 * None of these five endpoints appear in docs/raw/credits.md's endpoint
 * table — credit cost is undocumented for the whole family.
 *
 * Response bodies: the embedded OpenAPI schema gives an EMPTY schema
 * (`response200_schema: {}`, description "Successful Response") for every
 * one of these five endpoints — there is no field-level response
 * documentation at all, unlike every other family in this codebase. Per the
 * task's rule to never invent field names, response shapes below are
 * intentionally left as `z.unknown()` rather than guessed (e.g. assuming
 * `list` returns `{data: [...]}` the way every other paginated endpoint
 * does — plausible, but not documented, so not asserted).
 *
 * Request `data` field: the OpenAPI schema types `data` as a bare
 * `additionalProperties: true` object (server does not enforce a shape at
 * that level), but the doc's prose gives a full field-by-field table for
 * each of the three `type` values via a tabbed reference section (not part
 * of the embedded OpenAPI JSON). Those precise per-type shapes are modeled
 * below as CommonTokenTransferAlertData / SmTokenFlowsAlertData /
 * SmartContractCallAlertData for callers who know the alert `type`; the
 * request schemas themselves keep the permissive wire-level `data: object`
 * shape to match what the server actually accepts.
 */

// --- Shared helper shapes (named "MinMax"/"Target"/"Token" in the docs) ----

/** `{ min?: number, max?: number }`; either bound is optional. */
export const MinMax = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});
export type MinMax = z.infer<typeof MinMax>;

export const AlertTargetType = z.enum([
  "address",
  "entity",
  "label",
  "custom-label",
  "watchlist",
]);
export type AlertTargetType = z.infer<typeof AlertTargetType>;

export const AlertTarget = z.object({
  type: AlertTargetType,
  value: z.string(),
});
export type AlertTarget = z.infer<typeof AlertTarget>;

/** `{ chain: "ethereum", address: "0x..." }` */
export const AlertToken = z.object({
  chain: z.string(),
  address: z.string(),
});
export type AlertToken = z.infer<typeof AlertToken>;

// --- Alert types ------------------------------------------------------------

export const SmartAlertType = z.enum([
  "common-token-transfer",
  "sm-token-flows",
  "smart-contract-call",
]);
export type SmartAlertType = z.infer<typeof SmartAlertType>;

export const SmartAlertTimeWindow = z.enum([
  "realtime",
  "1m",
  "5m",
  "10m",
  "30m",
  "1h",
  "4h",
  "12h",
  "1d",
  "1w",
]);
export type SmartAlertTimeWindow = z.infer<typeof SmartAlertTimeWindow>;

// --- type="common-token-transfer" `data` shape ------------------------------

export const CommonTokenTransferEvent = z.enum(["buy", "sell", "swap", "send", "receive"]);
export type CommonTokenTransferEvent = z.infer<typeof CommonTokenTransferEvent>;

/**
 * TODO: verify against live response/support — the doc's table names
 * `tokens`, `tokenSectors`, `tokenAge`, `marketCap` as inclusion/exclusion
 * sub-fields but does not spell out their individual types. Inferred here
 * from the `Token`/`MinMax` helper shapes defined elsewhere on the same doc
 * page and from naming conventions used throughout the rest of this API
 * (age/cap fields as min/max ranges, sector filters as string arrays) —
 * not confirmed against an explicit schema.
 */
export const CommonTokenTransferInclusion = z.object({
  tokens: z.array(AlertToken).optional(),
  tokenSectors: z.array(z.string()).optional(),
  tokenAge: MinMax.optional(),
  marketCap: MinMax.optional(),
});
export type CommonTokenTransferInclusion = z.infer<typeof CommonTokenTransferInclusion>;

export const CommonTokenTransferAlertData = z.object({
  /** Chains to monitor, e.g. ["ethereum"]. */
  chains: z.array(z.string()),
  /** Who must be involved in the transfer. */
  subjects: z.array(AlertTarget),
  /** Transfer directions to match. */
  events: z.array(CommonTokenTransferEvent),
  /** Optional counterparties on the other side. */
  counterparties: z.array(AlertTarget).optional(),
  usdValue: MinMax.optional(),
  tokenAmount: MinMax.optional(),
  inclusion: CommonTokenTransferInclusion.optional(),
  exclusion: CommonTokenTransferInclusion.optional(),
});
export type CommonTokenTransferAlertData = z.infer<typeof CommonTokenTransferAlertData>;

// --- type="sm-token-flows" `data` shape -------------------------------------

/**
 * TODO: verify against live response/support — same caveat as
 * CommonTokenTransferInclusion above, plus `fdvUsd` which only appears here.
 */
export const SmTokenFlowsInclusion = z.object({
  tokens: z.array(AlertToken).optional(),
  tokenSectors: z.array(z.string()).optional(),
  tokenAge: MinMax.optional(),
  marketCap: MinMax.optional(),
  fdvUsd: MinMax.optional(),
});
export type SmTokenFlowsInclusion = z.infer<typeof SmTokenFlowsInclusion>;

export const SmTokenFlowsExclusion = z.object({
  tokens: z.array(AlertToken).optional(),
  tokenSectors: z.array(z.string()).optional(),
});
export type SmTokenFlowsExclusion = z.infer<typeof SmTokenFlowsExclusion>;

export const SmTokenFlowsAlertData = z.object({
  chains: z.array(z.string()),
  /** Fixed event tag for this alert type. */
  events: z.array(z.literal("sm-token-flows")),
  inflow_15m: MinMax.optional(),
  inflow_30m: MinMax.optional(),
  inflow_1h: MinMax.optional(),
  inflow_1d: MinMax.optional(),
  inflow_7d: MinMax.optional(),
  outflow_15m: MinMax.optional(),
  outflow_30m: MinMax.optional(),
  outflow_1h: MinMax.optional(),
  outflow_1d: MinMax.optional(),
  outflow_7d: MinMax.optional(),
  netflow_15m: MinMax.optional(),
  netflow_30m: MinMax.optional(),
  netflow_1h: MinMax.optional(),
  netflow_1d: MinMax.optional(),
  netflow_7d: MinMax.optional(),
  inclusion: SmTokenFlowsInclusion.optional(),
  exclusion: SmTokenFlowsExclusion.optional(),
});
export type SmTokenFlowsAlertData = z.infer<typeof SmTokenFlowsAlertData>;

// --- type="smart-contract-call" `data` shape --------------------------------

export const SmartContractCallTargets = z.object({
  caller: z.array(AlertTarget).optional(),
  smartContract: z.array(AlertTarget).optional(),
});
export type SmartContractCallTargets = z.infer<typeof SmartContractCallTargets>;

export const SmartContractCallAlertData = z.object({
  chains: z.array(z.string()),
  /** Fixed event tag for this alert type. */
  events: z.array(z.literal("smart-contract-call")),
  usdValue: MinMax.optional(),
  /** 4-byte method selectors, e.g. ["0x128acb08"]. */
  signatureHash: z.array(z.string()).optional(),
  inclusion: SmartContractCallTargets.optional(),
  exclusion: SmartContractCallTargets.optional(),
});
export type SmartContractCallAlertData = z.infer<typeof SmartContractCallAlertData>;

// --- Channels ----------------------------------------------------------------

export const TelegramChannelData = z.object({
  /** Prefix with "-" for group chats. */
  chatId: z.string(),
});
export type TelegramChannelData = z.infer<typeof TelegramChannelData>;

export const TelegramChannel = z.object({
  type: z.literal("telegram"),
  data: TelegramChannelData,
});
export type TelegramChannel = z.infer<typeof TelegramChannel>;

export const SlackChannelData = z.object({
  /** https only. */
  webhookUrl: z.string(),
});
export type SlackChannelData = z.infer<typeof SlackChannelData>;

export const SlackChannel = z.object({
  type: z.literal("slack"),
  data: SlackChannelData,
});
export type SlackChannel = z.infer<typeof SlackChannel>;

export const DiscordChannelData = z.object({
  /** https only. */
  webhookUrl: z.string(),
});
export type DiscordChannelData = z.infer<typeof DiscordChannelData>;

export const DiscordChannel = z.object({
  type: z.literal("discord"),
  data: DiscordChannelData,
});
export type DiscordChannel = z.infer<typeof DiscordChannel>;

export const WebhookChannelData = z.object({
  /** https only. */
  webhookUrl: z.string(),
  /** Optional signing secret, 16-512 chars. Enables an HMAC-SHA256 signature header on delivered payloads. */
  secret: z.string().min(16).max(512).optional(),
});
export type WebhookChannelData = z.infer<typeof WebhookChannelData>;

export const WebhookChannel = z.object({
  type: z.literal("webhook"),
  data: WebhookChannelData,
});
export type WebhookChannel = z.infer<typeof WebhookChannel>;

export const AlertChannel = z.discriminatedUnion("type", [
  TelegramChannel,
  SlackChannel,
  DiscordChannel,
  WebhookChannel,
]);
export type AlertChannel = z.infer<typeof AlertChannel>;

// ===========================================================================
// POST /api/v1/smart-alert — Create a smart alert
// ===========================================================================

export const CreateAlertRequest = z.object({
  /** Required. Human-readable name for the alert. */
  name: z.string(),
  /** Required. The kind of activity to watch. */
  type: SmartAlertType,
  /** Required. Evaluation window. Use "realtime" to fire per matching event. */
  timeWindow: SmartAlertTimeWindow,
  /** Required. One or more destinations that receive alert notifications. */
  channels: z.array(AlertChannel),
  /**
   * Required. Type-specific filter configuration — see
   * CommonTokenTransferAlertData / SmTokenFlowsAlertData /
   * SmartContractCallAlertData for the shape matching this request's `type`.
   * Kept as an open record here since the wire schema itself is
   * `additionalProperties: true` with no discriminator tying `data`'s shape
   * to `type` at the schema level.
   */
  data: z.record(z.string(), z.unknown()),
  description: z.string().optional(),
  /** Whether the alert is active on creation. Default true. */
  isEnabled: z.boolean().optional().default(true),
  /** Origin of the alert. Defaults to "agent" when omitted. */
  createdBy: z.string().optional(),
});
export type CreateAlertRequest = z.infer<typeof CreateAlertRequest>;

/**
 * TODO: verify against live response — docs give no response schema at all
 * for this endpoint (see file-level note). Not assumed to be the created
 * alert record, a bare success flag, or anything else specific.
 */
export const CreateAlertResponse = z.unknown();
export type CreateAlertResponse = z.infer<typeof CreateAlertResponse>;

// ===========================================================================
// PATCH /api/v1/smart-alert — Update a smart alert
// ===========================================================================

export const UpdateAlertRequest = z.object({
  /** Required. ID of the alert to update. */
  id: z.string(),
  name: z.string().optional(),
  type: SmartAlertType.optional(),
  timeWindow: SmartAlertTimeWindow.optional(),
  /** Replacement set of delivery destinations. */
  channels: z.array(AlertChannel).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  description: z.string().optional(),
  isEnabled: z.boolean().optional(),
});
export type UpdateAlertRequest = z.infer<typeof UpdateAlertRequest>;

/** TODO: verify against live response — see file-level note. */
export const UpdateAlertResponse = z.unknown();
export type UpdateAlertResponse = z.infer<typeof UpdateAlertResponse>;

// ===========================================================================
// GET /api/v1/smart-alert/list — List smart alerts
// ===========================================================================

/** No request body/query parameters. */
export const ListSmartAlertsRequest = z.object({});
export type ListSmartAlertsRequest = z.infer<typeof ListSmartAlertsRequest>;

/**
 * TODO: verify against live response — docs give no response schema at all
 * (see file-level note). Every other list-style endpoint in this API
 * returns `{data: [...], pagination: {...}}`, so that's a plausible shape
 * here too, but it is NOT asserted since this endpoint's docs don't
 * document it.
 */
export const ListSmartAlertsResponse = z.unknown();
export type ListSmartAlertsResponse = z.infer<typeof ListSmartAlertsResponse>;

// ===========================================================================
// PATCH /api/v1/smart-alert/toggle — Enable or disable a smart alert
// ===========================================================================

export const ToggleAlertRequest = z.object({
  /** Required. ID of the alert to toggle. */
  id: z.string(),
  /** Required. true to enable, false to disable. */
  isEnabled: z.boolean(),
});
export type ToggleAlertRequest = z.infer<typeof ToggleAlertRequest>;

/** TODO: verify against live response — see file-level note. */
export const ToggleAlertResponse = z.unknown();
export type ToggleAlertResponse = z.infer<typeof ToggleAlertResponse>;

// ===========================================================================
// DELETE /api/v1/smart-alert/{alert_id} — Delete a smart alert
// ===========================================================================

/** Path parameter, not a JSON body. */
export const DeleteAlertParams = z.object({
  alert_id: z.string(),
});
export type DeleteAlertParams = z.infer<typeof DeleteAlertParams>;

/** TODO: verify against live response — see file-level note. */
export const DeleteAlertResponse = z.unknown();
export type DeleteAlertResponse = z.infer<typeof DeleteAlertResponse>;
