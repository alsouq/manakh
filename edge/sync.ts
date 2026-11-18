// Cloud sync. The edge pushes buffered readings (and alarms) to the cloud and pulls the active
// strategy. mTLS + a device token in production; here the contract is an interface so the loop
// can run offline (NoopSync) or against a test double.
import type { Strategy } from "@/engine/types";
import type { Reading } from "./buffer";

export interface SyncResult {
  ok: boolean;
  strategy?: Strategy; // the cloud may hand back a newer active strategy
}

export interface CloudSync {
  push(readings: Reading[]): Promise<SyncResult>;
}

/** No cloud: the edge keeps controlling locally and buffering. */
export class NoopSync implements CloudSync {
  async push(): Promise<SyncResult> {
    return { ok: false };
  }
}

/** POSTs to the cloud edge endpoint with a device token. */
export class HttpSync implements CloudSync {
  constructor(
    private url: string,
    private token: string,
    private sectionId: string,
  ) {}
  async push(readings: Reading[]): Promise<SyncResult> {
    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ sectionId: this.sectionId, readings }),
      });
      if (!res.ok) return { ok: false };
      const data = (await res.json()) as { strategy?: Strategy };
      return { ok: true, strategy: data.strategy };
    } catch {
      return { ok: false };
    }
  }
}
