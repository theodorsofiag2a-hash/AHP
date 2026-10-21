import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo G2A + divisor + "AHP". Pensado para faixas escuras (a logo é dourada sobre transparente). */
export function BrandMark({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <Image
        src="/logo-g2a.png"
        alt="G2A Consultores"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
        priority
      />
      <span className="h-8 w-px bg-white/15" aria-hidden="true" />
      <span
        className="gold-gradient-text font-display text-xl font-bold tracking-widest"
        style={{ transform: `translateY(${size >= 56 ? 10 : 8}px)` }}
      >
        AHP
      </span>
    </span>
  );
}
