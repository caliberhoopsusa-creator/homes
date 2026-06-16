// Where the generated contract PDF lands. Default is an in-memory mock that
// returns a stable URL (fully testable); the production impl uploads to a
// Supabase Storage bucket. No service-role key in source — read from env.
import {
  ambientEnv,
  ambientFetch,
  type EnvLike,
  type FetchLike,
} from "./env.js";

export interface UploadResult {
  url: string;
}

export interface ContractStorage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<UploadResult>;
}

// ── Mock (default) ───────────────────────────────────────────────────────────
export class MockStorage implements ContractStorage {
  /** path -> bytes, so tests can assert what was written. */
  readonly objects = new Map<string, Uint8Array>();

  async upload(path: string, bytes: Uint8Array): Promise<UploadResult> {
    this.objects.set(path, bytes);
    return { url: `mock://contracts/${path}` };
  }
}

// ── Supabase Storage (production) ────────────────────────────────────────────
export interface SupabaseStorageOptions {
  env?: EnvLike;
  fetchImpl?: FetchLike;
  bucket?: string;
}

export class SupabaseStorage implements ContractStorage {
  private readonly baseUrl: string;
  private readonly serviceKey: string;
  private readonly bucket: string;
  private readonly fetchImpl: FetchLike;

  constructor(opts: SupabaseStorageOptions = {}) {
    const env = opts.env ?? ambientEnv();
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for SupabaseStorage.",
      );
    }
    this.baseUrl = url.replace(/\/$/, "");
    this.serviceKey = key;
    this.bucket = opts.bucket ?? env.CONTRACTS_BUCKET ?? "contracts";
    this.fetchImpl = opts.fetchImpl ?? ambientFetch();
  }

  async upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<UploadResult> {
    const endpoint = `${this.baseUrl}/storage/v1/object/${this.bucket}/${path}`;
    const res = await this.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.serviceKey}`,
        "content-type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!res.ok) throw new Error(`Supabase storage upload failed: ${res.status}`);
    // Bucket policy decides public vs signed; return the canonical object path.
    return { url: `${this.baseUrl}/storage/v1/object/public/${this.bucket}/${path}` };
  }
}

/** Factory: CONTRACT_STORAGE=mock (default) | supabase. */
export function makeStorage(env: EnvLike = ambientEnv()): ContractStorage {
  return (env.CONTRACT_STORAGE ?? "mock") === "supabase"
    ? new SupabaseStorage({ env })
    : new MockStorage();
}
