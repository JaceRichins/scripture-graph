/** Family onboarding (§60): open vault → welcome → invite code → done.
 * No terminals, no JSON, no API keys. */
import { Modal, Notice, Setting } from "obsidian";
import type { SGState } from "../state";
import type { AiService } from "../ai/aiService";

export class WelcomeModal extends Modal {
  constructor(private s: SGState, private ai: AiService, private onDone: () => void) {
    super(s.app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sg-welcome");
    contentEl.createEl("h2", { text: "Welcome to Scripture Graph" });
    contentEl.createEl("p", {
      text: "✓ Shared scriptures  ✓ Family highlights  ✓ Truly private notes  ✓ Study tools",
    });

    let invite = "";
    let name = "";
    let device = "My device";
    new Setting(contentEl).setName("Your name").addText(t =>
      t.setPlaceholder("e.g. Mom").onChange(v => (name = v)));
    new Setting(contentEl).setName("Invite code")
      .setDesc("From the family member who runs Scripture Graph")
      .addText(t => t.setPlaceholder("XXXX-XXXX-XXXX").onChange(v => (invite = v)));
    new Setting(contentEl).setName("This device").addText(t =>
      t.setValue(device).onChange(v => (device = v || "My device")));

    new Setting(contentEl)
      .addButton(b => b.setButtonText("Join").setCta().onClick(async () => {
        const code = invite.trim();
        if (!code) return void new Notice("Invite code required");
        // owner bootstrap prints a raw device token — accept it directly
        if (code.startsWith("sgd_")) {
          try {
            this.s.device.deviceToken = code;
            await this.s.saveDevice();
            const me = await this.s.api.me();
            this.s.device.userId = me.user.user_id;
            this.s.device.displayName = me.user.display_name;
            await this.s.saveDevice();
            await refreshIdentity(this.s);
            new Notice(`Welcome, ${me.user.display_name}!`);
            this.close();
            this.maybeOfferAi();
          } catch (e) {
            this.s.device.deviceToken = null;
            await this.s.saveDevice();
            new Notice(`Token rejected: ${(e as Error).message}`);
          }
          return;
        }
        if (!name.trim()) return void new Notice("Name and invite code required");
        try {
          const session = await this.s.api.claim(code, name.trim(), device);
          this.s.device.deviceToken = session.token;
          this.s.device.userId = session.user.user_id;
          this.s.device.displayName = session.user.display_name;
          await this.s.saveDevice();
          await refreshIdentity(this.s);
          new Notice(`Welcome, ${session.user.display_name}!`);
          this.close();
          this.maybeOfferAi();
        } catch (e) {
          // maybe it's a device-link code for an existing account
          try {
            const session = await linkDevice(this.s, invite.trim(), device);
            new Notice(`Welcome back, ${session.display_name}!`);
            this.close();
            this.maybeOfferAi();
          } catch {
            new Notice(`Could not join: ${(e as Error).message}`);
          }
        }
      }))
      .addButton(b => b.setButtonText("Maybe later").onClick(() => this.close()));
  }

  private maybeOfferAi() {
    const m = new Modal(this.app);
    m.contentEl.createEl("h3", { text: "Want AI features?" });
    m.contentEl.createEl("p", {
      text: "Ask questions about any verse using YOUR OWN AI balance (about $10 goes far). " +
        "Everything else works without it.",
    });
    new Setting(m.contentEl)
      .addButton(b => b.setButtonText("Connect AI").setCta().onClick(async () => {
        m.close();
        await this.ai.beginConnect();
        new Notice("Complete the authorization in your browser — Obsidian will catch the redirect.");
      }))
      .addButton(b => b.setButtonText("Maybe later").onClick(() => m.close()));
    m.open();
    this.onDone();
  }

  onClose() { this.contentEl.empty(); }
}

export async function linkDevice(s: SGState, code: string, deviceName: string) {
  const session = await s.api.linkDevice(code, deviceName);
  s.device.deviceToken = session.token;
  s.device.userId = session.user.user_id;
  s.device.displayName = session.user.display_name;
  await s.saveDevice();
  await refreshIdentity(s);
  return session.user;
}

export async function refreshIdentity(s: SGState): Promise<void> {
  if (!s.signedIn) return;
  try {
    const me = await s.api.me();
    s.groups = (me as unknown as { groups: { group_id: string; name: string; role: string }[] }).groups ?? [];
    for (const g of s.groups) {
      if (!(g.group_id in s.device.showScopes.groups)) {
        s.device.showScopes.groups[g.group_id] = true;
      }
    }
    await s.saveDevice();
    s.notify();
  } catch { /* offline is fine */ }
}
