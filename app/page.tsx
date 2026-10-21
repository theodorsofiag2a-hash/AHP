import { BarChart3, Coins, Scale } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";

const FEATURES = [
  {
    icon: Scale,
    title: "Matriz de Saaty",
    text: "Comparação pareada de critérios com cálculo automático de consistência (CR).",
  },
  {
    icon: BarChart3,
    title: "Ranking ponderado",
    text: "Alternativas avaliadas e ranqueadas com base em pesos e escalas de desempenho.",
  },
  {
    icon: Coins,
    title: "Créditos sob controle",
    text: "Pacotes pré-pagos, sem surpresas: você acompanha cada execução.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate overflow-hidden bg-ink-deep">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-[center_38%] saturate-[.72] contrast-[1.12] brightness-[.82]"
          style={{ backgroundImage: "url(/hero-energia.jpg)" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(15,15,11,0.72) 0%, rgba(15,15,11,0.30) 22%, rgba(15,15,11,0.34) 52%, rgba(15,15,11,0.80) 82%, #121210 100%), radial-gradient(55% 45% at 20% 6%, rgba(198,162,76,0.30), transparent 70%)",
          }}
          aria-hidden="true"
        />

        <header className="flex items-center justify-between px-6 py-6 sm:px-12">
          <BrandMark />
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="border border-white/25 text-white/85 hover:border-white/50 hover:bg-transparent hover:text-white"
              >
                Entrar
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-[#f3eee2] text-ink shadow-[0_2px_10px_rgba(0,0,0,0.25)] hover:bg-white">
                Criar conta
              </Button>
            </Link>
          </nav>
        </header>

        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-6 pb-32 pt-24 text-center md:pt-32">
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 font-ui text-[11px] uppercase tracking-[0.18em] text-ink-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden="true" />
            Decisão multicritério, com rigor
          </span>
          <h1
            className="animate-fade-up max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight text-[#faf9f6] [text-shadow:0_2px_24px_rgba(0,0,0,0.45)] md:text-7xl"
            style={{ animationDelay: "0.15s" }}
          >
            Decisões complexas, <span className="gold-gradient-text">clareza absoluta.</span>
          </h1>
          <p
            className="animate-fade-up max-w-xl text-balance text-lg leading-relaxed text-[#e9e3d5]"
            style={{ animationDelay: "0.3s" }}
          >
            A plataforma de AHP (Analytic Hierarchy Process) da G2A Consultores para comparar fornecedores e
            alternativas com metodologia comprovada, consistência matemática e insights acionáveis.
          </p>
          <div className="animate-fade-up flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "0.45s" }}>
            <Link href="/signup">
              <Button size="lg">Começar agora</Button>
            </Link>
            <Link href="/login">
              <Button
                variant="secondary"
                size="lg"
                className="border-white/25 bg-white/5 text-white backdrop-blur-sm hover:border-white/25 hover:bg-white/15"
              >
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
        <div className="divider-gold" aria-hidden="true" />
      </section>

      <main className="bg-ambient flex-1 px-6 py-24">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-eyebrow-gold font-ui">Como funciona</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight md:text-5xl">
            Rigor matemático, do critério ao ranking.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border-subtle bg-bg-surface p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="icon-badge-gold mb-5 h-12 w-12">
                  <f.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative bg-ink px-6 py-10 text-center sm:px-12">
        <div className="divider-gold absolute inset-x-0 top-0" aria-hidden="true" />
        <p className="text-xs text-[#8a857a]">© G2A Consultores. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
