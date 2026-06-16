/** Throw on a PostgREST error, else return the data. */
export function unwrap<T>(res: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** ISO timestamp for 00:00:00 UTC today (for the outreach daily-cap window). */
export function startOfUtcDay(d: Date = new Date()): string {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString();
}
