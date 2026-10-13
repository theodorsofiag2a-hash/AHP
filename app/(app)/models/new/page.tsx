import { notFound } from "next/navigation";
import { createModel } from "@/actions/models";
import { canManageModels, requireOrgContext } from "@/lib/org";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export default async function NewModelPage() {
  const org = await requireOrgContext();
  if (!canManageModels(org.role)) notFound();

  async function handleCreate(formData: FormData) {
    "use server";
    await createModel(String(formData.get("name") ?? ""));
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Novo modelo</CardTitle>
          <CardDescription>
            Dê um nome ao modelo. Você vai montar os pilares, subcritérios e escalas na próxima tela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome do modelo</Label>
              <Input id="name" name="name" placeholder="Ex: Fornecedores BESS LRCAP" required autoFocus />
            </div>
            <Button type="submit" className="w-full">Continuar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
