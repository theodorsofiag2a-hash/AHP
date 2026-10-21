import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifiqueSeuEmailPage() {
  return (
    <Card className="card-accent relative">
      <CardHeader className="items-center text-center">
        <div className="icon-badge-gold mb-2 h-12 w-12">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle>Verifique seu e-mail</CardTitle>
        <CardDescription>
          Enviamos um link de confirmação para o e-mail informado. Clique nele para ativar sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-text-faint">Não recebeu? Confira a caixa de spam ou tente se cadastrar de novo.</p>
        <Link href="/login" className="text-sm font-medium text-gold-700 underline-offset-4 hover:text-gold-600 hover:underline">
          Voltar ao login
        </Link>
      </CardContent>
    </Card>
  );
}
