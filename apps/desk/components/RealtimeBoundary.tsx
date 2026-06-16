"use client";
import { useRealtimeRefresh } from "@/lib/realtime";

// Drop-in client wrapper that subscribes a route to realtime table changes.
// No-op under fixtures. Renders nothing.
export function RealtimeBoundary({
  tables,
}: {
  tables: ("deals" | "contracts" | "buyers" | "matches")[];
}) {
  useRealtimeRefresh(tables);
  return null;
}
