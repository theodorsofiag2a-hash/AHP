import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/password-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const backLinkClasses = "text-sm font-medium text-gold-700 underline-offset-4 hover:text-gold-600 hover:underline";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enviado?: string }>;
}) {
  const { error, enviado } = await searchParams;

  if (enviado) {
    return (
      <Card className="card-accent relative">
        <CardHeader className="items-center text-center">
          <div className="icon-badge-gold mb-2 h-12 w-12">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>
            Se esse e-mail tiver uma conta, enviamos um link para criar uma nova senha. Abra o link neste mesmo
            navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-text-faint">Não chegou? Confira a caixa de spam ou peça um novo link.</p>
          <div className="flex gap-4">
            <Link href="/esqueci-senha" className={backLinkClasses}>
              Pedir novo link
            </Link>
            <Link href="/login" className={backLinkClasses}>
              Voltar ao login
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-accent relative">
      <CardHeader>
        <CardTitle>Esqueci minha senha</CardTitle>
        <CardDescription>Informe seu e-mail e enviaremos um link para criar uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <ForgotPasswordForm />
        <p className="text-center text-sm text-text-muted">
          Lembrou?{" "}
          <Link href="/login" className={backLinkClasses}>
            Voltar ao login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
