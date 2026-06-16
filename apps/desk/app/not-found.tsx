import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-lg font-semibold">Not found</h1>
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Back to pipeline
      </Link>
    </div>
  );
}
