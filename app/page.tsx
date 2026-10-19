import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="bg-ambient flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <Image src="/logo-g2a.png" alt="G2A Consultores" width={48} height={48} className="h-12 w-12 object-contain" priority />
          <span className="gold-gradient-text border-l border-border-subtle pl-3 text-lg font-semibold tracking-widest">AHP</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Criar conta</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <Badge variant="gold">Decisão multicritério, com rigor</Badge>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Decisões complexas,{" "}
          <span className="gold-gradient-text">clareza absoluta.</span>
        </h1>
        <p className="max-w-xl text-balance text-text-muted">
          A plataforma de AHP (Analytic Hierarchy Process) da G2A Consultores para
          comparar fornecedores e alternativas com metodologia comprovada, consistência
          matemática e insights acionáveis.
        </p>
        <div className="flex items-center gap-3">
          <Link href="/signup">
            <Button size="lg">Começar agora</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">Já tenho conta</Button>
          </Link>
        </div>

        <div className="mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-text-primary">Matriz de Saaty</p>
              <p className="mt-1 text-sm text-text-muted">
                Comparação pareada de critérios com cálculo automático de consistência (CR).
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-text-primary">Ranking ponderado</p>
              <p className="mt-1 text-sm text-text-muted">
                Alternativas avaliadas e ranqueadas com base em pesos e escalas de desempenho.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-sm font-semibold text-text-primary">Créditos sob controle</p>
              <p className="mt-1 text-sm text-text-muted">
                Pacotes pré-pagos, sem surpresas: você acompanha cada execução.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
