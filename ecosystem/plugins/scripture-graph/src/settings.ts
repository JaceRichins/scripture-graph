/** Settings tab: account, sharing filters, AI (connect/model/budget), study,
 * owner admin. Secrets never leave device-local storage. */
import { Modal, Notice, PluginSettingTab, Setting } from "obsidian";
import type SGPlugin from "./main";
import { WelcomeModal, linkDevice, refreshIdentity } from "./social/onboarding";
import { TIER_CANDIDATES, type Tier } from "@scripture-graph/core-sdk";
import { SCENES } from "./study/scenes";
import { isScripturePhoto } from './study/photoPolicy';
import { backgroundVisibility } from './study/backgroundVisibility';
import { SceneStorageModal } from './study/sceneStorage';
import { BUILD } from "./build";
import { SECTIONS, syncPrefs, sectionOn } from "./sync/vaultSync";
import { InviteLinkModal, SetupLinkModal, bestPublicUrl, buildSetupLink } from "./social/setupLink";

export class SGSettingsTab extends PluginSettingTab {
  constructor(private p: SGPlugin) { super(p.app, p); }

  private renderMusic(el: HTMLElement): void {
    const s = this.p.state;
    const sp = this.p.music.spotify;
    el.createEl("h2", { text: "Music" });
    new Setting(el).setName("Spotify")
      .setDesc(sp.connected ? "Connected — playlists play through your Spotify app, in the background."
        : sp.configured ? "Sign in once; then our playlists play through the Spotify app on this phone (Premium)."
          : "Not set up for the family yet: the owner adds the Spotify Client ID below.")
      .addButton(b => b.setButtonText(sp.connected ? "Disconnect" : "Connect").setCta().setDisabled(!sp.configured && !sp.connected)
        .onClick(async () => { if (sp.connected) { await sp.disconnect(); this.display(); } else await sp.beginConnect(); }));
    new Setting(el).setName("YouTube in the app")
      .setDesc("Songs, talks and podcasts the Church doesn't host play in a small YouTube window in the corner")
      .addToggle(t => t.setValue(s.device.youtube !== false).onChange(async v => { s.device.youtube = v; await s.saveDevice(); }));
    new Setting(el).setName("Spotify Client ID (family)")
      .setDesc("From developer.spotify.com — one app for the whole family; shared with the vault")
      .addText(t => t.setPlaceholder("32 characters").setValue(s.settings.spotifyClientId ?? "").onChange(async v => {
        s.applySettings({ spotifyClientId: v.trim() }); await this.p.saveSharedSettings();
      }));
  }

  private renderSync(el: HTMLElement): void {
    const s = this.p.state;
    const vs = this.p.vaultSync;
    el.createEl("h2", { text: "Vault sync" });
    const prefs = syncPrefs(s);
    const st = vs.status;
    const line = el.createDiv({ cls: "setting-item-description sg-sync-status" });
    const paint = () => {
      const when = st.lastRun ? new Date(st.lastRun).toLocaleString() : "never";
      line.toggleClass("sg-sync-failed", !st.running && !!st.lastError);
      line.setText(st.running
        ? `${st.phase}${st.total ? ` — ${st.done.toLocaleString()} of ${st.total.toLocaleString()} files` : "…"}`
        : `Last sync ${when} · ${st.files.toLocaleString()} files on this device`
          + (st.personalPushed || st.personalPulled ? ` · notes ↑${st.personalPushed} ↓${st.personalPulled}` : "")
          + (st.conflicts ? ` · ${st.conflicts} kept both` : "")
          + (st.lastError ? ` · ${st.lastError}` : ""));
    };
    paint();
    vs.listeners.push(paint);
    new Setting(el).setName("Sync from the family server")
      .setDesc("The whole shared vault comes from the server, and your own notes go both ways under your login. No Obsidian Sync needed.")
      .addToggle(t => t.setValue(prefs.enabled).onChange(async v => {
        s.device.sync = { ...(s.device.sync ?? {}), enabled: v };
        await s.saveDevice();
        if (v) vs.start(); else vs.stop();
      }));
    const known = [s.settings.serverUrl, ...(s.device.serverUrls ?? [])].filter((u, i, a) => u && a.indexOf(u) === i);
    el.createDiv({ cls: "setting-item-description", text: `Reachable at: ${known.join("  ·  ")}` });
    new Setting(el).setName("Sync now")
      .setDesc("Brings this device up to date with the family server: the library and your own notes.")
      .addButton(b => b.setButtonText("Sync").setCta().onClick(async () => {
        b.setButtonText("Syncing…").setDisabled(true);
        try { await this.p.syncEverything(); }
        finally { b.setButtonText("Sync").setDisabled(false); paint(); }
      }));
    new Setting(el).setName("Check every")
      .addDropdown(d => d.addOptions({ "15": "15 minutes", "30": "30 minutes", "60": "hour", "180": "3 hours" })
        .setValue(String(prefs.intervalMin)).onChange(async v => {
          s.device.sync = { ...(s.device.sync ?? {}), intervalMin: Number(v) };
          await s.saveDevice(); vs.start();
        }));
    el.createEl("h3", { text: "What this device carries" });
    new Setting(el).setName('Clean up unused downloads')
      .setDesc('On phones, remove replaceable downloads after this long without use. Scriptures, conference from the last two years, personal work, bookmarked or annotated pages, and deliberately saved offline collections stay. Older installs get a fresh grace period. Files remain searchable on the server.')
      .addDropdown(d => d.addOptions({ '30': '30 days', '60': '60 days', '90': '90 days', '180': '180 days', '0': 'Never' })
        .setValue(String(prefs.pruneDays)).onChange(async value => {
          s.device.sync = { ...s.device.sync, pruneDays: Number(value) }; await s.saveDevice();
        }));
    for (const sec of SECTIONS) {
      new Setting(el).setName(sec.label)
        .setDesc(sec.always ? "Always" : sec.defaultOn === false ? "Off: the Library still lists it, and a page is fetched the moment you open it. On: all of it, offline." : "")
        .addToggle(t => t.setValue(sectionOn(sec, prefs)).setDisabled(!!sec.always)
          .onChange(async v => {
            s.device.sync = { ...(s.device.sync ?? {}), sections: { ...(s.device.sync?.sections ?? {}), [sec.key]: v } };
            await s.saveDevice();
            await vs.resetIndex();        // the next run adds or removes the shelf
          }));
    }
    if (prefs.pins.some(pin => pin.endsWith('/'))) {
      el.createEl('h3', { text: 'Saved offline collections' });
      for (const pin of prefs.pins.filter(value => value.endsWith('/'))) {
        new Setting(el).setName(pin.split('/').filter(Boolean).pop() ?? pin)
          .setDesc('Kept offline until you allow cleanup. Your personal files are always protected.')
          .addButton(button => button.setButtonText('Allow cleanup').onClick(async () => {
            s.device.sync = { ...s.device.sync, pins: syncPrefs(s).pins.filter(value => value !== pin) };
            await s.saveDevice(); await vs.resetIndex(); this.display();
          }));
      }
    }
  }

  display(): void {
    const { containerEl: el } = this;
    const s = this.p.state;
    el.empty();

    // -------------------------------------------------------------- music
    this.renderMusic(el);

    // ---------------------------------------------------------- vault sync
    this.renderSync(el);

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
      // Anyone can bring someone in, not only the owner: the person doing the
      // inviting is the one holding the phone.
      new Setting(el).setName("Invite someone to the family")
        .setDesc("One link. They tap it, install, and their scriptures download — nothing to type.")
        .addButton(b => b.setButtonText("Make invite link").setCta().onClick(async () => {
          try {
            const invite = await s.api.createSetupInvite(s.groups[0]?.group_id ?? null);
            new InviteLinkModal(this.p, invite, s.device.displayName ?? null).open();
          } catch (e) { new Notice(`Could not make a link: ${(e as Error).message}`, 8000); }
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
        + "one chapter. Sidebars always open with their buttons, even when "
        + "chapter swiping is turned off.")
      .addToggle(t => t.setValue(s.device.swipeNav !== false)
        .onChange(async v => {
          s.device.swipeNav = v;
          await s.saveDevice();
        }));

    new Setting(el).setName("Reading scene")
      .setDesc("Personal backgrounds apply to personal pages. Scripture pages always use suitable scripture photos.")
      .addDropdown(d => {
        d.addOption("none", "None (plain)");
        d.addOption("auto", "Auto — follow the time of day");
        d.addOption("match", "📖 Match this page");
        for (const sc of SCENES) d.addOption(sc.id, `${sc.emoji} ${sc.name}${isScripturePhoto(sc.id) ? '' : ' (personal pages)'}`);
        d.setValue(s.device.scene ?? "none").onChange(async v => {
          s.device.scene = v;
          await s.saveDevice();
          this.p.applyConfiguredScene();
        });
      });

    new Setting(el).setName('Background photo visibility')
      .setDesc('Higher values show more of the photo. Lower values darken it for reading. Default: 35%.')
      .addSlider(slider => slider.setLimits(0, 100, 5).setValue(backgroundVisibility(s.device.backgroundVisibility))
        .setDynamicTooltip().onChange(async value => {
          s.device.backgroundVisibility = value;
          this.p.applyReadingPrefs();
          await s.saveDevice();
        }));
    new Setting(el).setName('Scene storage & offline favorites').setDesc('Download scenes as needed, with a default 100 MB cache.').addButton(b=>b.setButtonText('Manage scenes').onClick(()=>{
      if(this.p.scenes.cache)new SceneStorageModal(s.app,this.p.scenes.cache,()=>s.device.sceneCacheMB??100,async mb=>{s.device.sceneCacheMB=mb;await s.saveDevice();}).open();
    }));

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

    // ---------------------------------------------------------------- ask
    el.createEl("h2", { text: "Ask" });
    new Setting(el).setName("Answered by the family server")
      .setDesc("A ChatGPT session runs on the family's own computer, reads the library, and replies. " +
        "It can also act for you: open pages, highlight, connect passages, write lesson plans, change these settings. " +
        "Nothing to sign up for and no keys on this phone.");
    new Setting(el).setName("Reading text size")
      .setDesc("Also: ask the assistant to make the text bigger.")
      .addSlider(sl => sl.setLimits(70, 180, 5).setValue(Math.round((s.device.readScale || 1) * 100)).setDynamicTooltip()
        .onChange(async v => { s.device.readScale = v / 100; await s.saveDevice(); this.p.applyReadingPrefs(); }));
    if (s.aiConnected) {
      // a wallet connected in an earlier version: it is only a fallback now, and it can go
      new Setting(el).setName("Your own AI wallet (old)")
        .setDesc("An OpenRouter key from before. Used only if the family server can't answer. Forget it?")
        .addButton(b => b.setButtonText("Forget key").setWarning().onClick(async () => {
          await this.p.ai.disconnect(); this.display();
        }));
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
      .setDesc("Updates install automatically from GitHub when the app opens or returns to the foreground. The family server is a fallback.")
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
      // the easy path: one link that joins, switches sync on and downloads
      let who = "";
      new Setting(el).setName("Setup link for a family member")
        .setDesc("Text them one link. They install from inside Obsidian and tap it — no codes, no hidden folders.")
        .addText(t => t.setPlaceholder("their first name (optional)").onChange(v => (who = v.trim())))
        .addButton(b => b.setButtonText("Make link").setCta().onClick(async () => {
          const inv = await s.api.createAccountInvite(1, 24 * 30);
          const server = bestPublicUrl(this.p);
          new SetupLinkModal(this.p, buildSetupLink(server, inv.code, who || undefined), server, inv.code, who || "a family member").open();
        }));
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
