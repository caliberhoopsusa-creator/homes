import { NextResponse } from "next/server";
import { radiusPullRequest } from "@parcel/types";

// Stub sourcing entrypoint. Validates the RadiusPullRequest against the shared
// zod schema and returns 202 accepted. The actual radius pull (sourcing
// service → properties) runs server-side later; this just gates the contract.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = radiusPullRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid request", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  // TODO(parent/sourcing): enqueue this for services/sourcing to consume.
  return NextResponse.json(
    { accepted: true, request: parsed.data, queuedAt: new Date().toISOString() },
    { status: 202 },
  );
}
