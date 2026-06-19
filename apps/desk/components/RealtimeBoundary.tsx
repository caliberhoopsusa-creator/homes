"use client";
import { useRealtimeRefresh, type RealtimeTable } from "@/lib/realtime";

// Drop-in client wrapper that subscribes a route to realtime table changes.
// No-op under fixtures. Renders nothing.
export function RealtimeBoundary({ tables }: { tables: RealtimeTable[] }) {
  useRealtimeRefresh(tables);
  return null;
}
