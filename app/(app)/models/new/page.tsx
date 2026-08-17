import { createModel } from "@/actions/models";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export default function NewModelPage() {
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
