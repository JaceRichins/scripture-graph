/** One-tap family setup.
 *
 * The owner makes a link; the family member taps it on their phone and
 * the plugin does the rest — points at the server, joins with the invite,
 * turns vault sync on and starts the first download. Nothing to type but
 * a first name (and not even that when the link carries one).
 *
 *   obsidian://scripture-graph-setup?server=https://…&invite=XXXX-XXXX&name=Dad
 */
import { Modal, Notice, Platform, Setting } from "obsidian";
import type SGPlugin from "../main";
import { linkDevice, refreshIdentity } from "./onboarding";
import { DEFAULT_SYNC, SECTIONS } from "../sync/vaultSync";
import { BUILD } from '../build';

export const SETUP_RESUME_KEY = 'setup:resume-after-update';

export function buildSetupLink(server: string, invite: string, name?: string): string {
  const q = new URLSearchParams({ server: server.replace(/\/$/, ""), invite });
  if (name) q.set("name", name);
  return `obsidian://scripture-graph-setup?${q.toString()}`;
}

/** the address a phone away from home can reach: a public https one when
 * the server has advertised any, else whatever the settings say */
export function bestPublicUrl(p: SGPlugin): string {
  const s = p.state;
  const all = [s.settings.serverUrl, ...(s.device.serverUrls ?? [])].filter(Boolean);
  const isLan = (u: string) => /^(https?:\/\/)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost)/.test(u);
  return all.find(u => u.startsWith("https://") && !isLan(u)) ?? all.find(u => !isLan(u)) ?? s.settings.serverUrl;
}

/** what to text them, with the link and the two things they do by hand */
export function setupMessage(link: string, server: string, invite: string): string {
  const page = `${server.replace(/\/$/, "")}/setup?${new URLSearchParams({ invite }).toString()}`;
  return [
    "Scripture Graph — open this on your phone and follow the steps:",
    page,
    "",
    "(If the Connect button on that page does nothing, tap this instead once the plugin is installed:)",
    link,
  ].join("\n");
}

/** the whole invitation in one address: page, invite and server */
export function joinMessage(joinUrl: string, group: string, who?: string | null): string {
  return [
    `${who ? `${who} added you to` : "You're invited to"} ${group} on Scripture Graph.`,
    "Open this on your phone and follow the four steps — it installs the app, joins you, and downloads the scriptures:",
    joinUrl,
  ].join("\n");
}

/** sender side: the one link, ready to text */
export class InviteLinkModal extends Modal {
  constructor(private p: SGPlugin, private invite: { url: string | null; code: string; group_name: string; expires_at: string; max_uses: number },
    private who: string | null) { super(p.app); }
  onOpen() {
    const c = this.contentEl;
    c.createEl("h3", { text: `Invite someone to ${this.invite.group_name}` });
    const uses = this.invite.max_uses === 1 ? "one person" : `up to ${this.invite.max_uses} people`;
    const until = new Date(this.invite.expires_at).toLocaleDateString();
    c.createEl("p", { text: `Text them this link. It works for ${uses} until ${until}, on any phone — they don't need anything else from you.` });
    const url = this.invite.url;
    const msg = url ? joinMessage(url, this.invite.group_name, this.who) : "";
    if (url) {
      const box = c.createEl("textarea", { cls: "sg-setup-msg" });
      box.value = msg; box.rows = 6; box.readOnly = true;
      new Setting(c)
        .addButton(b => b.setButtonText("Copy message").setCta().onClick(async () => {
          await navigator.clipboard.writeText(msg); new Notice("Copied — paste it into a text");
        }))
        .addButton(b => b.setButtonText("Copy link only").onClick(async () => {
          await navigator.clipboard.writeText(url); new Notice("Link copied");
        }));
    } else {
      c.createEl("p", { text: "This server has no address the outside world can reach yet, so there is no link to send. Give them the code instead." });
    }
    c.createEl("p", { cls: "sg-setup-code", text: `Code, if they ask for one: ${this.invite.code}` });
  }
  onClose() { this.contentEl.empty(); }
}

function deviceLabel(): string {
  if (Platform.isIosApp) return "iPhone";
  if (Platform.isAndroidApp) return "Android phone";
  if (Platform.isMacOS) return "Mac";
  return "Computer";
}

/** the tapped link: join, switch sync on, fetch. Safe to tap twice. */
export async function runSetupLink(p: SGPlugin, params: Record<string, string>): Promise<void> {
  const s = p.state;
  const server = (params["server"] ?? "").trim().replace(/\/$/, "");
  const invite = (params["invite"] ?? "").trim();
  if (server && /^https?:\/\//.test(server)) {
    s.applySettings({ serverUrl: server });
    await p.saveSharedSettings();
  }
  // Already part of the family: the same link adds this account to the group
  // it names instead of refusing to do anything.
  if (s.signedIn && invite) {
    try {
      const joined = await s.api.acceptInvite(invite);
      await refreshIdentity(s);
      if (joined.group_name) new Notice(`Joined ${joined.group_name}.`, 6000);
    } catch { /* already a member, or the link was only ever for a new account */ }
  }
  if (!s.signedIn) {
    if (!invite) return void new Notice("This setup link has no invite in it. Ask for a new one.", 8000);
    const name = (params["name"] ?? "").trim() || await askName(p);
    if (!name) return;
    try {
      const session = await s.api.claim(invite, name, deviceLabel());
      s.device.deviceToken = session.token;
      s.device.userId = session.user.user_id;
      s.device.displayName = session.user.display_name;
      await s.saveDevice();
      await refreshIdentity(s);
    } catch (e) {
      try {
        await linkDevice(s, invite, deviceLabel());      // a device-link code for an existing account
      } catch {
        return void new Notice(`Could not join: ${(e as Error).message}. Ask for a fresh link.`, 10000);
      }
    }
  }
  s.device.sync = { ...(s.device.sync ?? {}), enabled: true };
  // Reconnect restores the normal small offline core + on-demand shelves.
  // Old download=all links are intentionally harmless after the correction.
  s.device.sync.sections = Object.fromEntries(SECTIONS.map(section => [section.key, !!section.always || (section.defaultOn ?? true)]));
  s.device.sync.intervalMin = DEFAULT_SYNC.intervalMin;
  await s.saveDevice();
  s.notify();
  // The same tap installs fixes first. A reload resumes the repair on startup.
  await s.store.put(SETUP_RESUME_KEY, true);
  if (await p.checkForUpdate(false)) return;
  const progress = new Notice("Connecting your library and checking for updates…", 0);
  const paint = () => {
    const st = p.vaultSync.status;
    progress.setMessage(st.total
      ? `Syncing offline essentials: ${st.done.toLocaleString()} of ${st.total.toLocaleString()}. Other collections open from the server when needed.`
      : "Connecting your library and checking for updates…");
  };
  p.vaultSync.listeners.push(paint);
  p.vaultSync.start();
  p.live?.start();
  let error: string | null = null;
  try {
    await s.api.me();
    await refreshIdentity(s);
    await p.vaultSync.refreshCatalog();
    const results = await Promise.allSettled([p.vaultSync.run("manual"), p.ann.syncNow(true)]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') error = String(failed.reason?.message ?? failed.reason);
  } catch (e) { error = (e as Error).message; }
  finally {
    p.vaultSync.listeners = p.vaultSync.listeners.filter(listener => listener !== paint);
    progress.hide();
    await s.store.delete(SETUP_RESUME_KEY);
  }
  const st = p.vaultSync.status;
  error ??= st.lastError;
  s.notify();
  new Notice(error ? `Setup hit a snag: ${error}. Tap the link again to retry.`
    : `Connected — automatic sync is on. Version ${BUILD.version}. ${p.vaultSync.catalogCount.toLocaleString()} library pages available; ${st.files.toLocaleString()} files kept offline. Family notes refreshed. Open Browse the Library for the full collection.`, 20000);
}

function askName(p: SGPlugin): Promise<string> {
  return new Promise(resolve => {
    const m = new Modal(p.app);
    let name = "";
    let done = false;
    m.contentEl.addClass("sg-welcome");
    m.contentEl.createEl("h2", { text: "Welcome to Scripture Graph" });
    m.contentEl.createEl("p", { text: "What should the family call you?" });
    new Setting(m.contentEl).setName("Your name").addText(t => {
      t.setPlaceholder("e.g. Dad").onChange(v => (name = v));
      t.inputEl.focus();
      t.inputEl.onkeydown = ev => { if (ev.key === "Enter" && name.trim()) { done = true; m.close(); resolve(name.trim()); } };
    });
    new Setting(m.contentEl).addButton(b => b.setButtonText("Continue").setCta().onClick(() => {
      if (!name.trim()) return void new Notice("Just a first name is fine");
      done = true; m.close(); resolve(name.trim());
    }));
    m.onClose = () => { m.contentEl.empty(); if (!done) resolve(""); };
    m.open();
  });
}

/** owner side: the link plus the message to text, with copy buttons */
export class SetupLinkModal extends Modal {
  constructor(private p: SGPlugin, private link: string, private server: string, private invite: string, private who: string) { super(p.app); }
  onOpen() {
    const c = this.contentEl;
    c.createEl("h3", { text: `Setup link for ${this.who}` });
    c.createEl("p", { text: "Text them this. They open the page, install the plugin from inside Obsidian, then tap the link — it joins, turns sync on and downloads the library. Good for 30 days, one use." });
    const msg = setupMessage(this.link, this.server, this.invite);
    const box = c.createEl("textarea", { cls: "sg-setup-msg" });
    box.value = msg; box.rows = 9; box.readOnly = true;
    new Setting(c)
      .addButton(b => b.setButtonText("Copy message").setCta().onClick(async () => {
        await navigator.clipboard.writeText(msg); new Notice("Copied — paste it into a text");
      }))
      .addButton(b => b.setButtonText("Copy link only").onClick(async () => {
        await navigator.clipboard.writeText(this.link); new Notice("Link copied");
      }));
  }
  onClose() { this.contentEl.empty(); }
}
