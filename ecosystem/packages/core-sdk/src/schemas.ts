/** Shared data contracts — one zod source of truth for plugin AND server. */
import { z } from "zod";

// ------------------------------------------------------------------ enums

export const AnnotationType = z.enum([
  "highlight", "note", "question", "bookmark", "reaction", "study-marker",
]);
export type AnnotationType = z.infer<typeof AnnotationType>;

/** local = never leaves the device; private = account-private (backend, owner
 * only); group = one group's members; public = every authenticated user. */
export const Visibility = z.enum(["local", "private", "group", "public"]);
export type Visibility = z.infer<typeof Visibility>;

export const AnchorType = z.enum(["verse", "chapter", "node"]);
export type AnchorType = z.infer<typeof AnchorType>;

export const SyncState = z.enum(["local_only", "pending_sync", "synced", "conflict"]);
export type SyncState = z.infer<typeof SyncState>;

// ------------------------------------------------------------- annotation

export const Annotation = z.object({
  annotation_id: z.string().uuid(),
  author_user_id: z.string().uuid().nullable(), // null while local-only/unclaimed
  anchor_type: AnchorType,
  /** verse: "alma-36-18" · chapter: "alma-36" · node: sg-id like "topic:faith" */
  anchor_id: z.string().min(2).max(200),
  annotation_type: AnnotationType,
  /** partial-verse anchoring (§9); null = whole verse/node */
  selected_text: z.string().max(2000).nullable().default(null),
  start_offset: z.number().int().min(0).nullable().default(null),
  end_offset: z.number().int().min(0).nullable().default(null),
  text_hash: z.string().max(16).nullable().default(null),
  /** note body / question text; empty for pure highlights */
  content: z.string().max(20000).default(""),
  color: z.string().max(20).nullable().default(null),
  /** text treatment: highlight (bg) | underline | bold | italic — null = highlight */
  style: z.string().max(20).nullable().default(null),
  /** user-named theme this mark belongs to ("Faith", "Covenants", …) */
  theme: z.string().max(60).nullable().default(null),
  visibility: Visibility,
  group_id: z.string().uuid().nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable().default(null),
  version: z.number().int().min(1).default(1),
});
export type Annotation = z.infer<typeof Annotation>;

// ------------------------------------------------------------- identities

export const User = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(80),
  role: z.enum(["owner", "member"]).default("member"),
  created_at: z.string(),
});
export type User = z.infer<typeof User>;

export const Group = z.object({
  group_id: z.string().uuid(),
  name: z.string().min(1).max(80),
  owner_user_id: z.string().uuid(),
  created_at: z.string(),
});
export type Group = z.infer<typeof Group>;

export const Membership = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["admin", "member"]),
  joined_at: z.string(),
});
export type Membership = z.infer<typeof Membership>;

export const Invite = z.object({
  code: z.string().min(8).max(24),
  kind: z.enum(["account", "group"]),
  group_id: z.string().uuid().nullable(),
  max_uses: z.number().int().min(1),
  uses: z.number().int().min(0),
  expires_at: z.string(),
  created_by: z.string().uuid(),
});
export type Invite = z.infer<typeof Invite>;

// ------------------------------------------------------------------- sync

export const SyncOpKind = z.enum(["upsert_annotation", "delete_annotation"]);

export const SyncOp = z.object({
  op_id: z.string().uuid(),           // client-generated; server idempotency key
  kind: SyncOpKind,
  annotation: Annotation,
  base_version: z.number().int().min(0), // version the client last saw (0 = new)
  queued_at: z.string(),
});
export type SyncOp = z.infer<typeof SyncOp>;

export const SyncPushResult = z.object({
  op_id: z.string().uuid(),
  status: z.enum(["applied", "duplicate", "conflict", "rejected"]),
  server_annotation: Annotation.nullable(),
  reason: z.string().optional(),
});
export type SyncPushResult = z.infer<typeof SyncPushResult>;

// ------------------------------------------------------------------ audit

export const AuditEvent = z.object({
  event_id: z.number().int(),
  at: z.string(),
  actor_user_id: z.string().uuid(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string(),
  detail: z.string().nullable(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

// ----------------------------------------------------------- API payloads

export const ClaimRequest = z.object({
  invite_code: z.string().min(4).max(64),
  display_name: z.string().min(1).max(80),
  device_name: z.string().min(1).max(120),
});

export const SessionInfo = z.object({
  user: User,
  device_id: z.string().uuid(),
  token: z.string().min(32),
});
export type SessionInfo = z.infer<typeof SessionInfo>;
