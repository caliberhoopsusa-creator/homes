# @parcel/desk

The Parcel operator cockpit (Next.js App Router). Runs on local fixtures with
zero setup — no Supabase env needed.

```bash
pnpm --filter @parcel/desk dev      # http://localhost:3000
pnpm --filter @parcel/desk build    # production build / typecheck
```

Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to switch from
fixtures to a live Supabase project (one-flag change; see `lib/data.ts`).
