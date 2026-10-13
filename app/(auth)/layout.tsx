import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ambient flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-gold-400 to-gold-700 text-sm font-bold text-[#141414]">
          G2
        </div>
        <span className="text-sm font-semibold tracking-wide">
          G2A <span className="gold-gradient-text">AHP</span>
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
