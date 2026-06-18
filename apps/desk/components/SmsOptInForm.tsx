"use client";
import { useState } from "react";

// The documented opt-in. Consent is an explicit, unchecked-by-default checkbox
// with the required disclosure — that's the TCPA paper trail. Submits to
// /api/sms/optin, which stores the consent event.
export function SmsOptInForm() {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/sms/optin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, consent, source: "web_optin" }),
      });
      if (res.ok) {
        setState("done");
      } else {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? "Something went wrong.");
        setState("error");
      }
    } catch {
      setError("Couldn't reach the server.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        You're subscribed. Reply <strong>STOP</strong> to any text to unsubscribe.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(406) 555-0123"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          I agree to receive text messages about my property from Parcel. Consent
          is not a condition of any sale. Msg &amp; data rates may apply. Reply
          STOP to unsubscribe, HELP for help.
        </span>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit"
        disabled={state === "saving" || !consent || phone.trim().length < 7}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-40"
      >
        {state === "saving" ? "Saving…" : "Subscribe to texts"}
      </button>
    </form>
  );
}
