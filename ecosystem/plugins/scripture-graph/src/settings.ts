/** Settings tab: account, sharing filters, AI (connect/model/budget), study,
 * owner admin. Secrets never leave device-local storage. */
import { Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type SGPlugin from "./main";
import { WelcomeModal, linkDevice, refreshIdentity } from "./social/onboarding";
import { TIER_CANDIDATES, type Tier } from "@scripture-graph/core-sdk";
import { SCENES } from "./study/scenes";
import { BUILD } from "./build";

export class SGSettingsTab extends PluginSettingTab {
  constructor(private p: SGPlugin) { super(p.app, p); }

  display(): void {
    const { containerEl: el } = this;
    const s = this.p.state;
    el.empty();

    // ------------------------------------------------------------ account
    el.createEl("h2", { text: "Account" });
    if (!s.signedIn) {
      new Setting(el).setName("Join Scripture Graph")
        .setDesc("Sign in with your family invite code")
        .addButton(b => b.setButtonText("Join…").setCta()
          .onClick(() => new WelcomeModal(s, this.p.ai, () => this.display()).open()));
    } else {
      new Setting(el).setName(`Signed in as ${s.device.displayName ?? "?"}`)
        .setDesc(`Groups: ${s.groups.map(g => g.name).join(", ") || "none yet"}`)
        .addButton(b => b.setButtonText("Sign out this device").onClick(async () => {
          try { await s.api.logoutDevice(); } catch { /* offline */ }
          s.device.deviceToken = null; s.device.userId = null;
          await s.saveDevice(); this.display();
        }));
      new Setting(el).setName("Link another device")
        .setDesc("Creates a one-time code (valid 1 hour) to sign THIS account in on your phone")
        .addButton(b => b.setButtonText("Create code").onClick(async () => {
          try {
            const inv = await s.api.createAccountInviteDeviceLink();
            new CodeModal(this.p, "Device link code", inv.code,
              "On the other device: Settings → Scripture Graph → Join → paste this code.").open();
          } catch (e) { new Notice((e as Error).message); }
        }));
      new Setting(el).setName("Create a group")
        .addText(t => t.setPlaceholder("e.g. Richins Family").then(t2 => {
          new Setting(el).addButton(b => b.setButtonText("Create").onClick(async () => {
            const name = t2.getValue().trim();
            if (!name) return;
            await s.api.createGroup(name);
            await refreshIdentity(s);
            new Notice(`Group “${name}” created`);
            this.display();
          }));
        }));
      for (const g of s.groups) {
        new Setting(el).setName(`👥 ${g.name}`).setDesc(g.role)
          .addButton(b => b.setButtonText("Invite…").onClick(async () => {
            try {
              const inv = await s.api.createGroupInvite(g.group_id);
              new CodeModal(this.p, `Invite to ${g.name}`, inv.code,
                "Share this code — it works for existing members via “Join group”, and the owner can bundle it into account invites.").open();
            } catch (e) { new Notice((e as Error).message); }
          }))
          .addButton(b => b.setButtonText("Leave").setWarning().onClick(async () => {
            await s.api.leaveGroup(g.group_id);
            await refreshIdentity(s);
            this.display();
          }));
      }
      new Setting(el).setName("Join a group").setDesc("Paste a group invite code")
        .addText(t => t.setPlaceholder("XXXX-XXXX-XXXX").then(t2 => {
          new Setting(el).addButton(b => b.setButtonText("Join group").onClick(async () => {
            try {
              const r = await s.api.acceptInvite(t2.getValue().trim());
              await refreshIdentity(s);
              new Notice(`Joined ${(r as { group_name?: string }).group_name ?? "group"}`);
              this.display();
            } catch (e) { new Notice((e as Error).message); }
          }));
        }));
    }

    // ------------------------------------------------------------ reading
    el.createEl("h2", { text: "Reading" });
    new Setting(el).setName("Chapter links open My Study page")
      .setDesc("Links like [[Matthew 5]] land on your editable page (the scripture "
        + "is embedded there). Verse-precise links still open the exact verse.")
      .addToggle(t => t.setValue(s.settings.chapterLinksToMyStudy)
        .onChange(async v => {
          s.applySettings({ chapterLinksToMyStudy: v });
          await this.p.saveSharedSettings();
        }));

    new Setting(el).setName("Show AI Library folder in sidebar")
      .setDesc("Off keeps the AI Library out of the file explorer on this device — "
        + "study pages still show and link its content (read-only). "
        + "Leave off on family devices.")
      .addToggle(t => t.setValue(s.device.showAiLibrary)
        .onChange(async v => {
          s.device.showAiLibrary = v;
          document.body.toggleClass("sg-hide-ai-lib", !v);
          await s.saveDevice();
        }));

    new Setting(el).setName("Swipe to turn the chapter")
      .setDesc("On the phone, a firm left/right swipe on a reading page moves "
        + "one chapter (Obsidian's sidebar swipes step aside there). "
        + "Turn off to give reading pages back to the sidebars.")
      .addToggle(t => t.setValue(s.device.swipeNav !== false)
        .onChange(async v => {
          s.device.swipeNav = v;
          // hand open reading pages back (or claim them) immediately
          if (!v) {
            for (const leaf of s.app.workspace.getLeavesOfType("markdown")) {
              const ce = (leaf.view as { contentEl?: HTMLElement }).contentEl;
              if (ce) delete ce.dataset.ignoreSwipe;
            }
          }
          await s.saveDevice();
        }));

    new Setting(el).setName("Reading scene")
      .setDesc("An ambient living backdrop behind the scriptures")
      .addDropdown(d => {
        d.addOption("none", "None (plain)");
        d.addOption("auto", "Auto — follow the time of day");
        d.addOption("match", "📖 Match the chapter");
        for (const sc of SCENES) d.addOption(sc.id, `${sc.emoji} ${sc.name}`);
        d.setValue(s.device.scene ?? "none").onChange(async v => {
          s.device.scene = v;
          await s.saveDevice();
          this.p.scenes.apply(v);
        });
      });

    // ------------------------------------------------------------ sharing
    el.createEl("h2", { text: "Sharing & privacy" });
    new Setting(el).setName("Default for new notes/highlights")
      .setDesc("🔐 Only me (synced) is recommended; 🔒 device-only never uploads anywhere")
      .addDropdown(d => d
        .addOption("private", "🔐 Only me (synced)")
        .addOption("local", "🔒 Only me (this device)")
        .setValue(s.settings.defaultVisibility)
        .onChange(async v => {
          s.settings.defaultVisibility = v as "private" | "local";
          await this.p.saveSharedSettings();
        }));
    new Setting(el).setName("Show my marks").addToggle(t =>
      t.setValue(s.device.showScopes.mine).onChange(async v => {
        s.device.showScopes.mine = v; await s.saveDevice(); s.notify();
      }));
    for (const g of s.groups) {
      new Setting(el).setName(`Show ${g.name}`).addToggle(t =>
        t.setValue(s.device.showScopes.groups[g.group_id] !== false).onChange(async v => {
          s.device.showScopes.groups[g.group_id] = v; await s.saveDevice(); s.notify();
        }));
    }
    new Setting(el).setName("Show public highlights").addToggle(t =>
      t.setValue(s.device.showScopes.public).onChange(async v => {
        s.device.showScopes.public = v; await s.saveDevice(); s.notify();
      }));

    // ----------------------------------------------------------------- ai
    el.createEl("h2", { text: "AI (your own wallet — never a shared key)" });
    if (!s.aiConnected) {
      new Setting(el).setName("Connect AI").setDesc(
        "Authorizes Scripture Graph to use YOUR OpenRouter balance. ~$10 lasts a long time.")
        .addButton(b => b.setButtonText("Connect AI").setCta().onClick(async () => {
          await this.p.ai.beginConnect();
          new Notice("Finish in the browser — Obsidian catches the redirect. " +
            "If it doesn't return, paste the code below.");
          this.display();
        }));
      new Setting(el).setName("Paste authorization code")
        .setDesc("Only needed if the browser redirect didn't come back")
        .addText(t => t.setPlaceholder("code from openrouter.ai").then(t2 => {
          new Setting(el).addButton(b => b.setButtonText("Finish connection").onClick(async () => {
            try { await this.p.ai.completeConnect(t2.getValue()); this.display(); }
            catch (e) { new Notice((e as Error).message); }
          }));
        }));
    } else {
      new Setting(el).setName("AI connected ✓")
        .addButton(b => b.setButtonText("Disconnect").setWarning()
          .onClick(async () => { await this.p.ai.disconnect(); this.display(); }));
      new Setting(el).setName("Preferred models").addDropdown(d => d
        .addOption("auto", "AUTO — recommended")
        .addOption("fast", "Fast & cheap")
        .addOption("deep", "Deep research")
        .addOption("best", "Highest quality")
        .addOption("cheapest", "Cheapest")
        .addOption("specific", "Specific model…")
        .setValue(s.device.aiTier)
        .onChange(async v => { s.device.aiTier = v as Tier; await s.saveDevice(); this.display(); }));
      if (s.device.aiTier === "specific") {
        new Setting(el).setName("Model id").setDesc("Advanced: any OpenRouter model id")
          .addText(t => t.setValue(s.device.aiSpecificModel ?? "")
            .setPlaceholder(TIER_CANDIDATES.deep[0] ?? "")
            .onChange(async v => { s.device.aiSpecificModel = v.trim() || null; await s.saveDevice(); }));
      }
      new Setting(el).setName("Monthly safety cap (USD)")
        .setDesc("Scripture Graph stops starting AI requests past this amount")
        .addText(t => {
          void this.p.state.budget.state().then(b => t.setValue(String(b.capUsd)));
          t.onChange(async v => {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 0) await this.p.state.budget.setCap(n);
          });
        });
      void this.p.state.budget.state().then(async b => {
        const wallet = await this.p.ai.wallet();
        new Setting(el).setName(
          `This month: $${b.spentUsd.toFixed(2)} / $${b.capUsd.toFixed(2)}`)
          .setDesc(wallet
            ? `OpenRouter wallet: $${wallet.usageUsd.toFixed(2)} used${wallet.limitUsd ? ` of $${wallet.limitUsd}` : ""}`
            : "");
      });
      new Setting(el).setName("Let AI read my private notes as context")
        .setDesc("Off by default. AI never modifies your notes either way (§27).")
        .addToggle(t => t.setValue(s.device.aiUsePersonalNotes)
          .onChange(async v => { s.device.aiUsePersonalNotes = v; await s.saveDevice(); }));
    }

    // ----------------------------------------------------------- my data
    el.createEl("h2", { text: "My data" });
    new Setting(el).setName("Export my data")
      .setDesc("All annotations + highlights → Markdown/JSON in Library/Exports")
      .addButton(b => b.setButtonText("Export").onClick(() => void this.p.exportMyData()));
    // the manifest is what Obsidian thinks is installed; BUILD is what is
    // actually running — Sync lands the manifest first, so they can differ
    const code = BUILD.version === this.p.manifest.version
      ? `build ${BUILD.sha}`
      : `⚠ code is v${BUILD.version} (${BUILD.sha}) — main.js hasn't synced yet`;
    new Setting(el).setName(`Plugin version: v${this.p.manifest.version} · ${code}`)
      .setDesc("Updates come straight from your family server — no sync games")
      .addButton(b => b.setButtonText("Check for updates")
        .onClick(() => void this.p.checkForUpdate(false)));
    new Setting(el).setName("Debug: copy interaction log")
      .setDesc("Copies what the touch layer saw (taps, selections, decisions) — "
        + "paste it to whoever is fixing a bug")
      .addButton(b => b.setButtonText("Copy log").onClick(async () => {
        const { traceDump } = await import("./study/trace");
        await navigator.clipboard.writeText(
          `Scripture Graph v${this.p.manifest.version} code=v${BUILD.version}@${BUILD.sha} ${BUILD.at}
`
          + traceDump());
        new Notice("Interaction log copied — paste it in a message");
      }))
      .addToggle(t => t.setValue(s.device.debugOverlay ?? false)
        .onChange(async v => {
          s.device.debugOverlay = v;
          await s.saveDevice();
          const { setOverlay } = await import("./study/trace");
          setOverlay(v);
        }));
    new Setting(el).setName("Server address").setDesc(
      "Shared with the whole vault (everyone needs the same backend)")
      .addText(t => t.setValue(s.settings.serverUrl).onChange(async v => {
        s.applySettings({ serverUrl: v.trim() });
        await this.p.saveSharedSettings();
      }));

    // -------------------------------------------------------------- admin
    if (s.signedIn && s.groups.some(() => true)) { /* member view ends here */ }
    void this.renderAdmin(el);
  }

  private async renderAdmin(el: HTMLElement) {
    const s = this.p.state;
    if (!s.signedIn) return;
    try {
      const me = await s.api.me() as unknown as { user: { role: string } };
      if (me.user.role !== "owner") return;
      el.createEl("h2", { text: "Owner admin" });
      new Setting(el).setName("New family account invite")
        .addButton(b => b.setButtonText("Create invite").onClick(async () => {
          const inv = await s.api.createAccountInvite(1, 24 * 30);
          new CodeModal(this.p, "Family account invite", inv.code,
            "Single use, 30 days. They enter it in Join Scripture Graph.").open();
        }));
      const over = await s.api.adminOverview().catch(() => null);
      if (over) {
        el.createEl("p", {
          text: `Backend: ${over["users"]} users · ${over["devices"]} devices · ` +
            `${over["groups"]} groups · ${over["annotations"]} annotations`,
        });
      }
    } catch { /* offline */ }
  }
}

class CodeModal extends Modal {
  constructor(p: SGPlugin, private title: string, private code: string, private hint: string) {
    super(p.app);
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: this.title });
    const codeEl = this.contentEl.createEl("code", { text: this.code, cls: "sg-invite-code" });
    this.contentEl.createEl("p", { text: this.hint });
    new Setting(this.contentEl).addButton(b => b.setButtonText("Copy").setCta()
      .onClick(async () => {
        await navigator.clipboard.writeText(this.code);
        new Notice("Copied");
      }));
    codeEl.onclick = () => void navigator.clipboard.writeText(this.code);
  }
  onClose() { this.contentEl.empty(); }
}
