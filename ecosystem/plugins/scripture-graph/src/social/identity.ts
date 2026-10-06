import type { SGState } from '../state';

const pending = new WeakMap<SGState, Promise<void>>();

/** Reconcile the token's actual account before personal sync. Keep the previous
 * account's local work in an archive rather than uploading it as the new user. */
export async function refreshIdentity(s: SGState, strict = false): Promise<void> {
  if (!s.signedIn) return;
  let work = pending.get(s);
  if (!work) {
    work = reconcile(s);
    pending.set(s, work);
  }
  try { await work; }
  catch (error) { if (strict) throw error; }
  finally { if (pending.get(s) === work) pending.delete(s); }
}

async function reconcile(s: SGState): Promise<void> {
  const me = await s.api.me();
  const old = s.device.userId;
  if (old && old !== me.user.user_id) {
    if (!/^[a-zA-Z0-9-]+$/.test(old)) throw Error('Invalid previous account ID');
    const marker = 'identity:transition';
    let transition = await s.store.get<{ from: string; to: string; archive: string }>(marker);
    if (!transition) {
      transition = { from: old, to: me.user.user_id, archive: `.scripture-graph-accounts/${old}/${Date.now()}` };
      await s.store.put(marker, transition);
    }
    if (transition.from !== old || transition.to !== me.user.user_id) throw Error('Account change is still pending');
    const adapter = s.app.vault.adapter;
    const parts = transition.archive.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join('/');
      if (!(await adapter.exists(path))) await adapter.mkdir(path);
    }
    // Rename is local and preserves every file, including unsynced edits.
    if (await adapter.exists('Library')) {
      if (await adapter.exists(`${transition.archive}/Library`)) throw Error('Previous account archive already exists');
      await adapter.rename('Library', `${transition.archive}/Library`);
    }
    const keys = [
      ...await s.store.keys('ann/'), ...await s.store.keys('sv/'), ...await s.store.keys('syncq/'),
      'sync_cursor', 'vaultsync:personal', 'vaultsync:personal-since',
    ];
    for (const key of keys) {
      const value = await s.store.get(key);
      if (value !== null) {
        await s.store.put(`account-archive/${transition.archive}/${key}`, value);
        await s.store.delete(key);
      }
    }
    s.socialCache.clear();
    s.device.showScopes = { mine: true, groups: {}, public: false };
    s.device.lastShareScope = { visibility: 'private', groupId: null };
  }
  const previousId = s.device.userId, previousName = s.device.displayName;
  const previousFamily = { familyProfileUserId: s.device.familyProfileUserId, familyPersonId: s.device.familyPersonId,
    familySpouseId: s.device.familySpouseId, familySpouseLabel: s.device.familySpouseLabel };
  s.device.userId = me.user.user_id;
  s.device.displayName = me.user.display_name;
  s.device.familyProfileUserId = me.user.user_id;
  s.device.familyPersonId = me.user.family_person_id ?? null;
  s.device.familySpouseId = me.user.family_spouse_id ?? null;
  s.device.familySpouseLabel = me.user.family_spouse_label ?? null;
  s.groups = (me as unknown as { groups?: SGState['groups'] }).groups ?? [];
  for (const group of s.groups) {
    if (!(group.group_id in s.device.showScopes.groups)) s.device.showScopes.groups[group.group_id] = true;
  }
  try { await s.saveDevice(); }
  catch (error) { s.device.userId = previousId; s.device.displayName = previousName; Object.assign(s.device, previousFamily); throw error; }
  await s.store.delete('identity:transition');
  s.notify();
}
