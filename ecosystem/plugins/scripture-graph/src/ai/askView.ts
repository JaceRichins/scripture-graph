/** Ask AI pane (§24): a right-sidebar chat over curated vault context, with
 * clickable [[wikilink]] citations, streamed answers, and save-as-note. */
import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from "obsidian";
import type { AiTask } from "@scripture-graph/core-sdk";
import { PERSONAL_PREFIX, SGState } from "../state";
import type { AnnotationService } from "../social/annotations";
import type { AiService } from "./aiService";
import { assembleContext, contextToMessages } from "./context";

export const ASK_VIEW = "scripture-graph-ask";

interface Turn { role: "user" | "assistant"; text: string; model?: string }

const ACTION_PRESETS: { label: string; task: AiTask; template: (a: string) => string }[] = [
  { label: "Explain", task: "verse", template: a => `Explain ${a} clearly for serious study.` },
  { label: "Connections", task: "connections", template: a => `What are the most meaningful connections to ${a} across the scriptures and this vault?` },
  { label: "Historical context", task: "history", template: a => `What is the historical context of ${a}?` },
  { label: "Language & text", task: "language", template: a => `What language, translation, or textual observations matter in ${a}?` },
  { label: "Evidence", task: "evidence", template: a => `What evidence and honest counter-considerations relate to ${a}?` },
  { label: "Challenge it", task: "challenge", template: a => `Give the strongest skeptical reading of ${a}, then the strongest response.` },
];

export class AskView extends ItemView {
  private turns: Turn[] = [];
  private anchorChapter: string | null = null;
  private anchorVerse: string | null = null;
  private busy = false;
  private inputEl!: HTMLTextAreaElement;
  private logEl!: HTMLElement;
  private headerEl!: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private s: SGState, private ai: AiService,
    private ann: AnnotationService) {
    super(leaf);
  }

  getViewType() { return ASK_VIEW; }
  getDisplayText() { return "Ask Scripture Graph"; }
  getIcon() { return "sparkles"; }

  setAnchor(chapterTitle: string | null, verseId: string | null, seed?: string) {
    this.anchorChapter = chapterTitle;
    this.anchorVerse = verseId;
    this.renderHeader();
    if (seed !== undefined) this.inputEl.value = seed;
    this.inputEl.focus();
  }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("sg-ask");
    this.headerEl = root.createDiv({ cls: "sg-ask-header" });
    this.logEl = root.createDiv({ cls: "sg-ask-log" });
    const presets = root.createDiv({ cls: "sg-ask-presets" });
    for (const p of ACTION_PRESETS) {
      const b = presets.createEl("button", { text: p.label });
      b.onclick = () => {
        const a = this.anchorVerse
          ? this.anchorVerse.replace(/^(.*)-(\d+)-(\d+)$/, () => `${this.anchorChapter}:${this.anchorVerse!.split("-").pop()}`)
          : this.anchorChapter ?? "this passage";
        void this.send(p.template(a), p.task);
      };
    }
    const inputRow = root.createDiv({ cls: "sg-ask-input" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { placeholder: "Ask about this passage — or anything in your vault…" },
    });
    const send = inputRow.createEl("button", { text: "Ask" });
    send.onclick = () => void this.send(this.inputEl.value.trim(),
      this.anchorChapter ? "verse" : "vault");
    this.inputEl.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.send(this.inputEl.value.trim(), this.anchorChapter ? "verse" : "vault");
      }
    });
    this.renderHeader();
    this.renderStatusLine();
  }

  private renderHeader() {
    if (!this.headerEl) return;
    this.headerEl.empty();
    const scope = this.anchorVerse
      ? `${this.anchorChapter} · verse ${this.anchorVerse.split("-").pop()}`
      : this.anchorChapter ?? "Entire vault";
    this.headerEl.createSpan({ text: `Context: ${scope}` });
    const depth = this.headerEl.createEl("select");
    for (const d of ["focused", "balanced", "deep"] as const) {
      const o = depth.createEl("option", { text: d[0]!.toUpperCase() + d.slice(1), value: d });
      if (d === this.s.device.aiDepth) o.selected = true;
    }
    depth.onchange = () => {
      this.s.device.aiDepth = depth.value as "focused" | "balanced" | "deep";
      void this.s.saveDevice();
    };
    if (this.anchorChapter) {
      const clear = this.headerEl.createEl("button", { text: "whole vault" });
      clear.onclick = () => this.setAnchor(null, null);
    }
  }

  private async renderStatusLine() {
    const b = await this.s.budget.state();
    const el = this.logEl.createDiv({ cls: "sg-ask-status" });
    if (!this.s.aiConnected) {
      el.setText("AI not connected — open Settings → Scripture Graph → Connect AI. " +
        "Everything else works without it.");
    } else {
      el.setText(`This month: $${b.spentUsd.toFixed(2)}${b.capUsd ? ` / $${b.capUsd.toFixed(2)}` : ""} · your own AI wallet`);
    }
  }

  private async send(question: string, task: AiTask) {
    if (!question || this.busy) return;
    this.busy = true;
    this.inputEl.value = "";
    this.turns.push({ role: "user", text: question });
    this.appendTurn({ role: "user", text: question });
    const answerEl = this.appendTurn({ role: "assistant", text: "…" });
    try {
      const personal = this.s.device.aiUsePersonalNotes
        ? await this.s.sync.allAnnotations() : [];
      const ctx = await assembleContext(this.s, question,
        this.anchorChapter ? { chapterTitle: this.anchorChapter, verseId: this.anchorVerse } : null,
        personal);
      const built = contextToMessages(ctx, question); // [system, user-with-context]
      const history = this.turns.slice(0, -1).slice(-6)
        .map(t => ({ role: t.role, content: t.text }));
      const messages = [built[0]!, ...history, built[1]!];
      let acc = "";
      const res = await this.ai.ask(task, messages, delta => {
        acc += delta;
        answerEl.setText(acc);
      });
      this.turns.push({ role: "assistant", text: res.text, model: res.model });
      await this.renderMarkdown(answerEl, res.text);
      const meta = answerEl.createDiv({ cls: "sg-ask-meta" });
      meta.setText(`${res.model} · ~$${res.costUsd.toFixed(4)}`);
      const save = meta.createEl("button", { text: "Save as note" });
      save.onclick = () => void this.saveAsNote(question, res.text);
      void this.renderStatusLine();
    } catch (e) {
      answerEl.setText(`⚠ ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private appendTurn(t: Turn): HTMLElement {
    const el = this.logEl.createDiv({ cls: `sg-turn sg-turn-${t.role}` });
    el.setText(t.text);
    el.scrollIntoView({ block: "end" });
    return el;
  }

  private async renderMarkdown(el: HTMLElement, text: string) {
    el.empty();
    await MarkdownRenderer.render(this.app, text, el, "", this);
  }

  /** §52: outputs become PERSONAL drafts, intentionally. */
  private async saveAsNote(question: string, answer: string) {
    const folder = `${PERSONAL_PREFIX}AI Notes`;
    const name = question.slice(0, 60).replace(/[<>:"/\\|?*#^\[\]]/g, "").trim() || "AI note";
    const path = `${folder}/${name} (${new Date().toISOString().slice(0, 10)}).md`;
    try {
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      await this.app.vault.create(path,
        `---\nownership: personal\nmutable: user\ncontent_type: ai-conversation\n---\n\n# ${name}\n\n**Q:** ${question}\n\n${answer}\n`);
      new Notice("Saved to Library/AI Notes");
    } catch (e) {
      new Notice(`Could not save: ${(e as Error).message}`);
    }
  }
}
