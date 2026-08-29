/** Shared plugin context: settings (shared, non-secret, in data.json) vs
 * device-local state (secrets + personal data, in localStorage — NEVER in
 * data.json because Obsidian Sync replicates data.json to every vault user). */
import { requestUrl, type App, type Plugin } from "obsidian";
import {
  ApiClient, Budget, SyncEngine, WebStorage,
  type Annotation, type FetchLike, type ModelInfo, type Tier, type AiTask,
} from "@scripture-graph/core-sdk";

export const CANONICAL_PREFIX = "AI Library/01 Scriptures/Canonical/";
export const LIBRARY_PREFIX = "AI Library/";
export const PERSONAL_PREFIX = "Library/";

/** Shared, non-secret settings — synced with the vault ON PURPOSE so the
 * whole family gets the server URL and defaults automatically. */
export interface MarkTheme {
  name: string;
  color: string;
  style: string; // highlight | underline | bold | italic
}

export interface SharedSettings {
  serverUrl: string;
  defaultVisibility: "local" | "private";
  forceLibraryPreview: boolean;
  /** chapter-level wikilinks land on the editable "<Chapter> - My Notes" page
   * (which embeds the scripture); verse-anchored links still open canonical */
  chapterLinksToMyStudy: boolean;
  /** family-shared mark themes: a named color+treatment vocabulary */
  themes: MarkTheme[];
}

export const DEFAULT_SHARED: SharedSettings = {
  serverUrl: "http://127.0.0.1:8930",
  defaultVisibility: "private",
  forceLibraryPreview: true,
  chapterLinksToMyStudy: true,
  themes: [],
};

/** Device-local (secret or personal) state. */
export interface DeviceState {
  deviceToken: string | null;
  userId: string | null;
  displayName: string | null;
  openrouterKey: string | null;
  aiTier: Tier;
  aiSpecificModel: string | null;
  aiUsePersonalNotes: boolean;
  showScopes: { mine: boolean; groups: Record<string, boolean>; public: boolean };
  aiDepth: "focused" | "balanced" | "deep";
  /** last sharing scope used from the action bar — one-tap highlights */
  lastShareScope: { visibility: "local" | "private" | "group" | "public"; groupId: string | null };
  /** last highlight color used from the action bar */
  lastColor: string;
  /** last text treatment used from the action bar */
  lastStyle: string;
  /** last theme applied from the action bar (name, or null) */
  lastTheme: string | null;
  /** show the interaction-trace overlay (debugging aid) */
  debugOverlay: boolean;
  /** last chapter opened — powers "Continue reading" in the navigator */
  lastChapter: { slug: string; title: string } | null;
  /** parallel studies: the last few distinct chapters, most recent first */
  recentChapters: { slug: string; title: string; at: string }[];
  /** show the AI Library folder in the file explorer (power users only;
   * off keeps family devices from ever wandering in — links still work) */
  showAiLibrary: boolean;
  /** ambient reading scene: "none" | "auto" | scene id */
  scene: string;
}

export const DEFAULT_DEVICE: DeviceState = {
  deviceToken: null,
  userId: null,
  displayName: null,
  openrouterKey: null,
  aiTier: "auto",
  aiSpecificModel: null,
  aiUsePersonalNotes: false,
  showScopes: { mine: true, groups: {}, public: false },
  aiDepth: "balanced",
  lastShareScope: { visibility: "private", groupId: null },
  lastColor: "yellow",
  lastStyle: "highlight",
  lastTheme: null,
  debugOverlay: false,
  lastChapter: null,
  recentChapters: [],
  showAiLibrary: false,
  scene: "none",
};

export interface SocialAnnotation extends Annotation { author_name?: string }

export class SGState {
  settings: SharedSettings = { ...DEFAULT_SHARED };
  device: DeviceState = { ...DEFAULT_DEVICE };
  store: WebStorage;
  sync: SyncEngine;
  budget: Budget;
  api: ApiClient;
  modelRegistry: ModelInfo[] = [];
  groups: { group_id: string; name: string; role: string }[] = [];
  /** anchor_id -> social annotations from the last query (others' shared) */
  socialCache = new Map<string, SocialAnnotation[]>();
  onChange: (() => void)[] = [];

  constructor(public app: App, public plugin: Plugin) {
    const ns = `sg:${(app as unknown as { appId?: string }).appId ?? "vault"}`;
    this.store = new WebStorage(ns, globalThis.localStorage);
    this.sync = new SyncEngine(this.store);
    this.budget = new Budget(this.store);
    // Obsidian's requestUrl runs in the native layer: no CORS preflight and no
    // iOS cleartext/mixed-content blocks — required for http://LAN sync on phones
    const fetchLike: FetchLike = async (url, init) => {
      const res = await requestUrl({
        url, method: init.method, headers: init.headers, body: init.body, throw: false,
      });
      return {
        status: res.status,
        json: async () => { try { return res.json as unknown; } catch { return {}; } },
      };
    };
    this.api = new ApiClient(DEFAULT_SHARED.serverUrl, fetchLike, null);
  }

  async loadDevice(): Promise<void> {
    const d = await this.store.get<DeviceState>("device");
    if (d) this.device = { ...DEFAULT_DEVICE, ...d };
    this.api.setToken(this.device.deviceToken);
  }

  async saveDevice(): Promise<void> {
    await this.store.put("device", this.device);
    this.api.setToken(this.device.deviceToken);
  }

  applySettings(s: Partial<SharedSettings>): void {
    this.settings = { ...DEFAULT_SHARED, ...this.settings, ...s };
    this.api.baseUrl = this.settings.serverUrl;
  }

  get signedIn(): boolean { return !!this.device.deviceToken; }
  get aiConnected(): boolean { return !!this.device.openrouterKey; }

  notify(): void { for (const f of this.onChange) { try { f(); } catch { /* ui */ } } }

  /** set by AnnotationService: re-decorates rendered verses IN PLACE */
  redecorate: (() => Promise<void>) | null = null;

  /** Marks appear/disappear the moment anything changes. Decoration happens
   * in place on the existing DOM — a full markdown re-render would reset the
   * reading position to the top of the file (user-reported bug). */
  rerenderReading(): void {
    this.notify();
    void this.redecorate?.();
  }
}
