import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Card className="max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="icon-badge-gold h-12 w-12">
            <FileQuestion className="h-6 w-6" />
          </div>
          <CardTitle>Página não encontrada</CardTitle>
          <CardDescription>O que você procura não existe ou foi removido.</CardDescription>
          <Link href="/dashboard">
            <Button variant="secondary" className="mt-2">
              Voltar ao dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
