"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Falha de rede (conexão caiu, Wi-Fi/VPN trocou) ao buscar a página — não é erro do app. */
function isNetworkError(error: Error): boolean {
  return /network|failed to fetch|load failed|fetch failed|ERR_NETWORK|ERR_INTERNET/i.test(error.message ?? "");
}

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const offline = isNetworkError(error);

  // Busca a página de novo no servidor (só reset() redesenharia a mesma tela que falhou).
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Queda de conexão: tenta de novo sozinho quando a internet volta.
  useEffect(() => {
    if (!offline) return;
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Card className="max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
            {offline ? <WifiOff className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <CardTitle>{offline ? "A conexão caiu" : "Algo deu errado"}</CardTitle>
          <CardDescription>
            {offline
              ? "Não conseguimos falar com o servidor porque a internet oscilou. Seus dados já salvos estão seguros. Assim que a conexão voltar, a página carrega sozinha."
              : "Não foi possível carregar esta página. Tente novamente."}
          </CardDescription>
          {!offline && error.digest && <p className="text-xs text-text-faint">Código do erro: {error.digest}</p>}
          <Button variant="secondary" className="mt-2" onClick={retry} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
