import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="relative bg-ink px-6 py-5 sm:px-10">
        <Link href="/" className="inline-block">
          <BrandMark size={56} />
        </Link>
        <div className="divider-gold absolute inset-x-0 bottom-0" aria-hidden="true" />
      </header>
      <div className="bg-ambient flex flex-1 items-center justify-center px-6 py-16">
        <div className="animate-fade-up w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
