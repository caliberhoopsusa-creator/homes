/** A read-only environment bag, read via globalThis so it needs no @types/node. */
export type EnvLike = Record<string, string | undefined>;

export function ambientEnv(): EnvLike {
  const proc = (globalThis as { process?: { env?: EnvLike } }).process;
  return proc?.env ?? {};
}
