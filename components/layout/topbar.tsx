import Link from "next/link";
import { Coins, LogOut } from "lucide-react";
import { signOut } from "@/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Topbar({
  organizationName,
  creditBalance,
  userEmail,
}: {
  organizationName: string;
  creditBalance: number;
  userEmail: string | null;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border-subtle px-6">
      <div>
        <p className="text-sm font-semibold text-text-primary">{organizationName}</p>
        {userEmail && <p className="text-xs text-text-faint">{userEmail}</p>}
      </div>

      <div className="flex items-center gap-3">
        <Link href="/billing">
          <Badge variant="gold" className="cursor-pointer">
            <Coins className="h-3 w-3" />
            {creditBalance} {creditBalance === 1 ? "crédito" : "créditos"}
          </Badge>
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}
