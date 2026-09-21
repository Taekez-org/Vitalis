import "./globals.css";
import { RevisionsNav } from "@/components/revisions-nav";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><Link href="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">V</span><span><strong className="block text-sm tracking-tight">Verificador Vitalis</strong><small className="block text-xs text-muted-foreground">Controle de guias</small></span></Link><nav aria-label="Navegação principal" className="flex flex-wrap gap-1"><Button variant="secondary" size="sm" asChild><Link href="/">Guias</Link></Button><Button variant="ghost" size="sm" asChild><Link href="/pendencias">Pendências</Link></Button><RevisionsNav /><Button variant="ghost" size="sm" asChild><Link href="/dashboard">Dashboard</Link></Button></nav></div></header><main className="mx-auto max-w-6xl px-4 py-10">{children}</main><footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground">Dados fictícios da prova técnica · Regras: agosto/2026</footer></body></html>;
}
