import { SmsOptInForm } from "@/components/SmsOptInForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Text updates — Parcel",
};

// Public opt-in page (link it from emails/letters). Capturing explicit consent
// here is what makes any later SMS legal under the TCPA.
export default function SmsOptInPage() {
  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">
        Get text updates on your property offer
      </h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Prefer texts? Add your number and we'll reach you there about a cash offer
        for your home. You can opt out anytime.
      </p>
      <SmsOptInForm />
    </div>
  );
}
