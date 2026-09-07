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
  await s.saveDevice();
  s.notify();
  new Notice(`Welcome, ${s.device.displayName ?? "friend"}! Downloading the library — this takes a minute or two.`, 10000);
  p.vaultSync.start();
  await p.vaultSync.run("manual");
  const st = p.vaultSync.status;
  new Notice(st.lastError ? `Setup hit a snag: ${st.lastError}. Tap the link again to retry.`
    : `All set — ${st.files.toLocaleString()} files on this ${deviceLabel()}. Tap ⌂ Home to begin.`, 12000);
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
