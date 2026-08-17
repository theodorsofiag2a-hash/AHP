import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifiqueSeuEmailPage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft text-gold-400">
          <MailCheck className="h-6 w-6" />
        </div>
        <CardTitle>Verifique seu e-mail</CardTitle>
        <CardDescription>
          Enviamos um link de confirmação para o e-mail informado. Clique nele para ativar sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
