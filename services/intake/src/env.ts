// Minimal local typings + helpers so this module needs no @types/node.
// `process` is read via a globalThis cast so it can't collide with @types/node's
// `Process` typing when that package is present elsewhere in the workspace.

/** A read-only environment bag (a subset of process.env). */
export type EnvLike = Record<string, string | undefined>;

/** The slice of the Fetch Response we consume. */
export interface FetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** The slice of fetch we inject (so providers stay testable). */
export type FetchLike = (input: string, init?: unknown) => Promise<FetchResponse>;

/** Read the ambient environment safely, even where `process` is undefined. */
export function ambientEnv(): EnvLike {
  const proc = (globalThis as { process?: { env?: EnvLike } }).process;
  return proc?.env ?? {};
}

/** The global fetch, typed as FetchLike, without depending on @types/node. */
export function ambientFetch(): FetchLike {
  const f = (globalThis as { fetch?: FetchLike }).fetch;
  if (!f) throw new Error("global fetch is not available in this runtime");
  return f;
}
