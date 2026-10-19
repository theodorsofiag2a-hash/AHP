import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ambient flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <Link href="/" className="flex items-center gap-3">
        <Image src="/logo-g2a.png" alt="G2A Consultores" width={56} height={56} className="h-14 w-14 object-contain" priority />
        <span className="gold-gradient-text border-l border-border-subtle pl-3 text-lg font-semibold tracking-widest">AHP</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
