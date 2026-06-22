/** Throw on a PostgREST error, else return the data. */
export function unwrap<T>(res: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

interface RangeQuery<T> {
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}

const PAGE_SIZE = 1000; // PostgREST's max rows per request

/**
 * Fetch ALL rows for a select, paging past PostgREST's 1000-row cap. Pass a
 * builder factory (so each page gets a fresh query): `fetchAll(() =>
 * db.from("x").select("*"))`. Without this, any table over 1000 rows is silently
 * truncated — which hid the newest leads from underwriting and the desk.
 */
export async function fetchAll<T>(build: () => RangeQuery<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = unwrap(await build().range(from, from + PAGE_SIZE - 1));
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

/** ISO timestamp for 00:00:00 UTC today (for the outreach daily-cap window). */
export function startOfUtcDay(d: Date = new Date()): string {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString();
}
