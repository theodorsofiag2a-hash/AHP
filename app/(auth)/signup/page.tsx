import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Card className="card-accent relative">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Comece a estruturar suas decisões com AHP.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <SignupForm />

        <p className="text-center text-sm text-text-muted">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-gold-700 underline-offset-4 hover:text-gold-600 hover:underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
