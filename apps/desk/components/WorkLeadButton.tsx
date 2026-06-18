"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { workLeadAction } from "@/app/actions";

// Promote a raw lead into the pipeline, then jump to its new deal page so the
// beginner sees the next step (make an offer) immediately.
export function WorkLeadButton({ propertyId }: { propertyId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const dealId = await workLeadAction(propertyId);
          router.push(`/deals/${dealId}`);
        })
      }
      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? "Adding…" : "Work this lead →"}
    </button>
  );
}
