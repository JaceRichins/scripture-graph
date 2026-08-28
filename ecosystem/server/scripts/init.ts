/** One-time owner bootstrap: creates the owner account, a first device token,
 * a family group, and account invites — printed ONCE, stored only as hashes. */
import { audit, createDevice, createInvite, createUser, now } from "../src/auth";
import { openDb } from "../src/db";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env["SG_DB"] ?? "data/scripturegraph-social.sqlite3";
const name = process.argv[2] ?? "Vault Owner";
const groupName = process.argv[3] ?? "Family";

const db = openDb(DB_PATH);
const existing = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
if (existing.n > 0) {
  console.log("Users already exist — refusing to re-init. Use the plugin admin panel for invites.");
  process.exit(1);
}

const ownerId = createUser(db, name, "owner");
const dev = createDevice(db, ownerId, "owner-desktop");
const groupId = randomUUID();
db.prepare("INSERT INTO groups(group_id, name, owner_user_id, created_at) VALUES (?,?,?,?)")
  .run(groupId, groupName, ownerId, now());
db.prepare("INSERT INTO group_memberships(group_id,user_id,role,joined_at) VALUES (?,?,'admin',?)")
  .run(groupId, ownerId, now());
const familyInvites = [1, 2, 3, 4, 5].map(() =>
  createInvite(db, "account", ownerId, { groupId, maxUses: 1, ttlHours: 24 * 30 }));
audit(db, ownerId, "server.initialized", "user", ownerId);

console.log("================ SCRIPTURE GRAPH — OWNER BOOTSTRAP ================");
console.log(`Owner:        ${name}`);
console.log(`Group:        ${groupName}`);
console.log("");
console.log("OWNER DEVICE TOKEN (paste into the plugin on THIS computer, shown once):");
console.log(`  ${dev.token}`);
console.log("");
console.log("FAMILY ACCOUNT INVITES (each joins the family group; single-use, 30 days):");
for (const inv of familyInvites) console.log(`  ${inv.code}`);
console.log("");
console.log("These values are stored only as hashes — copy them now.");
console.log("===================================================================");
