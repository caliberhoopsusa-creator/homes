import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Parcel Desk" };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Parcel<span className="text-blue-600"> desk</span>
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Sign in to continue.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
