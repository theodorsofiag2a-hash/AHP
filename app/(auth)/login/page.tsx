import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string; next?: string }>;
}) {
  const { error, info } = await searchParams;

  return (
    <Card className="card-accent relative">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta para continuar suas análises.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {info && !error && (
          <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">{info}</p>
        )}
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <LoginForm />

        <p className="text-center text-sm text-text-muted">
          Não tem conta?{" "}
          <Link href="/signup" className="font-medium text-gold-700 underline-offset-4 hover:text-gold-600 hover:underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
