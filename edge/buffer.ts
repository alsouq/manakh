// Durable local buffer for readings while the cloud is unreachable. JSONL on disk, idempotent
// by (sensor, ts) so a replayed tick never double-writes. In production this would be SQLite;
// the interface is the same, so swapping is a one-file change.
import { appendFileSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Reading {
  sensor: string;
  ts: number;
  value: number;
}

export class ReadingBuffer {
  private seen = new Set<string>();
  private synced = 0;

  constructor(private file: string) {
    if (existsSync(file)) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line) continue;
        try {
          const r = JSON.parse(line) as Reading & { synced?: boolean };
          this.seen.add(`${r.sensor}|${r.ts}`);
        } catch {
          /* skip corrupt line */
        }
      }
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "");
    }
  }

  append(readings: Reading[]): number {
    let added = 0;
    const lines: string[] = [];
    for (const r of readings) {
      const key = `${r.sensor}|${r.ts}`;
      if (this.seen.has(key)) continue;
      this.seen.add(key);
      lines.push(JSON.stringify(r));
      added++;
    }
    if (lines.length) appendFileSync(this.file, lines.join("\n") + "\n");
    return added;
  }

  /** readings not yet marked synced */
  unsynced(limit = 500): Reading[] {
    const out: Reading[] = [];
    const lines = readFileSync(this.file, "utf8").split("\n");
    for (let i = this.synced; i < lines.length && out.length < limit; i++) {
      if (lines[i]) out.push(JSON.parse(lines[i]));
    }
    return out;
  }
  markSynced(n: number) {
    this.synced += n;
  }
  get pending() {
    return this.seen.size - this.synced;
  }
}
