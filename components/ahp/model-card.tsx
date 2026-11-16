import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ModelCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:border-gold-500/40 hover:shadow-card-hover">
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium text-text-primary">{title}</p>
            <p className="text-xs text-text-faint">{subtitle}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-text-faint" />
        </CardContent>
      </Card>
    </Link>
  );
}
