// Minimal local typings + helpers so this module needs no @types/node.
// The monorepo does not install @types/node; we declare only what we use and
// keep all runtime behavior dependency-free. (No secrets in source — env reads
// are funneled through here.)

/** A read-only environment bag (a subset of process.env). */
export type EnvLike = Record<string, string | undefined>;

// Ambient declaration for the one Web global this service references directly.
// Real runtimes (Node 18+, Bun, edge) provide `fetch`; declaring the minimal
// shape locally avoids a hard dependency on @types/node. `process` is read via a
// globalThis cast in `ambientEnv()` so it can't collide with @types/node's
// `Process` typing when that package is present elsewhere in the workspace.
declare global {
  function fetch(input: string, init?: unknown): Promise<FetchResponse>;
}

/** The slice of the Fetch Response we consume. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

/** The slice of fetch we inject (so providers stay testable). */
export type FetchLike = (input: string, init?: unknown) => Promise<FetchResponse>;

/** Read the ambient environment safely, even where `process` is undefined. */
export function ambientEnv(): EnvLike {
  const proc = (globalThis as { process?: { env?: EnvLike } }).process;
  return proc?.env ?? {};
}

/** Pure, dependency-free base64url encoder (replaces Buffer for tokens). */
export function base64url(input: string): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += alphabet[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += alphabet[b2 & 0x3f];
  }
  return out;
}
