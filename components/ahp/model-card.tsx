import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ModelCard({
  href,
  title,
  subtitle,
  locked = false,
}: {
  href: string;
  title: string;
  subtitle: string;
  /** Versão gratuita: o modelo aparece, mas não abre. */
  locked?: boolean;
}) {
  if (locked) {
    return (
      <Card aria-disabled="true" className="h-full cursor-not-allowed bg-bg-surface-alt opacity-70">
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium text-text-muted">{title}</p>
            <p className="text-xs text-text-faint">Disponível na versão completa</p>
          </div>
          <Lock className="h-4 w-4 text-text-faint" aria-label="Bloqueado na versão gratuita" />
        </CardContent>
      </Card>
    );
  }

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
