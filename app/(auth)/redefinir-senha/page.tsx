import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Card className="card-accent relative">
      <CardHeader>
        <CardTitle>Criar nova senha</CardTitle>
        <CardDescription>Escolha uma senha nova para acessar sua conta.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
