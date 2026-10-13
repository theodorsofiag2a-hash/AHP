import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function VerifiqueSeuEmailPage() {
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="icon-badge-gold mb-2 h-12 w-12">
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
