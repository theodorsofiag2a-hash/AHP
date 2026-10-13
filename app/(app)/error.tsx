"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Card className="max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle>Algo deu errado</CardTitle>
          <CardDescription>Não foi possível carregar esta página. Tente novamente.</CardDescription>
          <Button variant="secondary" className="mt-2" onClick={() => reset()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
