import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ambient flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo-g2a.png" alt="G2A Consultores" width={40} height={40} className="h-10 w-10 object-contain" priority />
        <span className="text-sm font-semibold tracking-wide">
          G2A <span className="gold-gradient-text">AHP</span>
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
