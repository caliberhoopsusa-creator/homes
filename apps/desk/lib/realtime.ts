"use client";
// Supabase realtime subscription hooks. Under fixtures (no env) these no-op,
// so the UI behaves identically with or without a live backend. When a live
// project is wired, they subscribe to table changes so warm leads / contracts
// appear without a manual refresh.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "./supabase";

type Table = "deals" | "contracts" | "buyers" | "matches";

/**
 * Subscribe to postgres changes on a table and refresh the route on any event.
 * No-op when Supabase is not configured (fixtures mode).
 */
export function useRealtimeRefresh(tables: Table[]): void {
  const router = useRouter();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return; // fixtures mode — nothing to subscribe to

    const channel = sb.channel(`desk:${tables.join(",")}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh(),
      );
    }
    channel.subscribe();

    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), router]);
}
