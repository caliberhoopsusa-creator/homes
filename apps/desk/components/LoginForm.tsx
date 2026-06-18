"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push(params.get("next") || "/");
        router.refresh();
      } else {
        setError("Wrong password.");
        setBusy(false);
      }
    } catch {
      setError("Couldn't reach the server.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Operator password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-40"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
