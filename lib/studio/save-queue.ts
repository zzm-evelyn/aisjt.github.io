import type { StudioAction } from "./service";
type Edit = Extract<StudioAction, { action: "editTask" }>;
export type DraftPatch = Edit["patch"];
export type Recovery = { revision: number; patches: DraftPatch[] };
/** Serial, latest-per-content-key writes; edits to different items are never dropped. */
export class DraftQueue {
  private pending: DraftPatch[] = [];
  private active: DraftPatch | null = null;
  private running = false;
  constructor(
    public revision: number,
    private send: (revision: number, patch: DraftPatch) => Promise<number>,
    private backup: (value: Recovery | null) => void,
    private status: (message: string) => void,
  ) {}
  get busy() {
    return this.running || this.pending.length > 0;
  }
  private persist() {
    const patches = this.active ? [this.active, ...this.pending] : this.pending;
    this.backup(
      patches.length
        ? { revision: this.revision, patches: structuredClone(patches) }
        : null,
    );
  }
  schedule(patch: DraftPatch) {
    const key = (p: DraftPatch) =>
      p.kind === "item"
        ? "item:" + p.itemId
        : p.kind === "story"
          ? "story:" + p.eventId
          : p.kind === "outline" && p.direction === "stay"
            ? "outline:" + p.eventId
            : p.kind === "name"
              ? "name"
              : null;
    const k = key(patch);
    const index = k ? this.pending.findIndex((p) => key(p) === k) : -1;
    if (index >= 0) this.pending[index] = patch;
    else this.pending.push(patch);
    this.persist();
    this.status("等待保存…");
  }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        this.active = this.pending.shift()!;
        this.status("保存中…");
        this.persist();
        try {
          this.revision = await this.send(this.revision, this.active!);
          this.active = null;
          this.persist();
        } catch {
          this.pending.unshift(this.active!);
          this.active = null;
          this.persist();
          this.status("保存失败 · 本地恢复副本已保留");
          return;
        }
      }
      this.status("已保存");
    } finally {
      this.running = false;
    }
  }
}
