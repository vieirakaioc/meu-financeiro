"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  TrendingUp,
  Wallet,
  BarChart3,
  Sparkles,
  ChevronRight,
} from "lucide-react";

type Usuario = {
  id: string;
};

type TipoCategoria = "receita" | "despesa";

type Categoria = {
  id: string;
  nome: string;
  tipo: TipoCategoria;
};

type Transacao = {
  id: string;
  category_id: string | null;
  valor: number | string;
  data_lancamento: string;
  tipo: TipoCategoria;
};

type MesRef = {
  label: string;
  month: number;
  year: number;
  key: string;
};

type LinhaDRE = {
  nome: string;
  tipo: TipoCategoria;
  valores: number[];
  total: number;
};

const formatarValorTabela = (v: number) => {
  if (v === 0) return "-";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
};

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

function gerarUltimos6Meses(): MesRef[] {
  const meses: MesRef[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);

    meses.push({
      label: d
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "")
        .toUpperCase(),
      month: d.getMonth(),
      year: d.getFullYear(),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }

  return meses;
}

export default function RelatoriosPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Usuario | null>(null);
  const [dadosDRE, setDadosDRE] = useState<LinhaDRE[]>([]);
  const [mesesHeader, setMesesHeader] = useState<MesRef[]>([]);

  useEffect(() => {
    carregarDRE();
  }, []);

  const carregarDRE = async () => {
    setIsLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw new Error(userError.message);

      if (!user) {
        router.replace("/login");
        return;
      }

      setUser({ id: user.id });

      const meses = gerarUltimos6Meses();
      setMesesHeader(meses);

      const primeiroMes = meses[0];
      const ultimoMes = meses[meses.length - 1];

      const dataInicio = new Date(primeiroMes.year, primeiroMes.month, 1)
        .toISOString()
        .split("T")[0];

      const dataFim = new Date(ultimoMes.year, ultimoMes.month + 1, 0)
        .toISOString()
        .split("T")[0];

      const [categoriasRes, transacoesRes] = await Promise.all([
        supabase
          .from("categories")
          .select("id, nome, tipo")
          .eq("user_id", user.id)
          .order("tipo", { ascending: true })
          .order("nome", { ascending: true }),

        supabase
          .from("transactions")
          .select("id, category_id, valor, data_lancamento, tipo")
          .eq("user_id", user.id)
          .gte("data_lancamento", dataInicio)
          .lte("data_lancamento", dataFim),
      ]);

      if (categoriasRes.error) throw new Error(categoriasRes.error.message);
      if (transacoesRes.error) throw new Error(transacoesRes.error.message);

      const categorias = (categoriasRes.data ?? []) as Categoria[];
      const transacoes = (transacoesRes.data ?? []) as Transacao[];

      const estrutura: LinhaDRE[] = categorias.map((cat) => {
        const valoresMensais = meses.map((mes) => {
          return transacoes
            .filter((t) => {
              if (t.category_id !== cat.id) return false;

              const data = new Date(`${t.data_lancamento}T00:00:00`);
              return data.getMonth() === mes.month && data.getFullYear() === mes.year;
            })
            .reduce((acc, curr) => acc + Number(curr.valor ?? 0), 0);
        });

        return {
          nome: cat.nome,
          tipo: cat.tipo,
          valores: valoresMensais,
          total: valoresMensais.reduce((a, b) => a + b, 0),
        };
      });

      const estruturaComMovimento = estrutura.filter((linha) =>
        linha.valores.some((v) => v !== 0)
      );

      setDadosDRE(estruturaComMovimento);
    } catch (err: any) {
      alert("🛑 Erro ao carregar relatório: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const receitas = useMemo(
    () => dadosDRE.filter((d) => d.tipo === "receita"),
    [dadosDRE]
  );

  const despesas = useMemo(
    () => dadosDRE.filter((d) => d.tipo === "despesa"),
    [dadosDRE]
  );

  const totaisReceitaPorMes = useMemo(() => {
    return mesesHeader.map((_, i) =>
      receitas.reduce((acc, linha) => acc + (linha.valores[i] ?? 0), 0)
    );
  }, [mesesHeader, receitas]);

  const totaisDespesaPorMes = useMemo(() => {
    return mesesHeader.map((_, i) =>
      despesas.reduce((acc, linha) => acc + (linha.valores[i] ?? 0), 0)
    );
  }, [mesesHeader, despesas]);

  const resultadoPorMes = useMemo(() => {
    return mesesHeader.map(
      (_, i) => (totaisReceitaPorMes[i] ?? 0) - (totaisDespesaPorMes[i] ?? 0)
    );
  }, [mesesHeader, totaisReceitaPorMes, totaisDespesaPorMes]);

  const resumo = useMemo(() => {
    const receitaAcumulada = totaisReceitaPorMes.reduce((a, b) => a + b, 0);
    const despesaAcumulada = totaisDespesaPorMes.reduce((a, b) => a + b, 0);
    const resultadoAcumulado = receitaAcumulada - despesaAcumulada;

    const mediaReceita = mesesHeader.length ? receitaAcumulada / mesesHeader.length : 0;
    const mediaDespesa = mesesHeader.length ? despesaAcumulada / mesesHeader.length : 0;
    const mediaResultado = mesesHeader.length
      ? resultadoAcumulado / mesesHeader.length
      : 0;

    return {
      receitaAcumulada,
      despesaAcumulada,
      resultadoAcumulado,
      mediaReceita,
      mediaDespesa,
      mediaResultado,
    };
  }, [mesesHeader.length, totaisDespesaPorMes, totaisReceitaPorMes]);

  return (
    <div className="min-h-screen text-gray-100 flex font-sans no-tap-highlight">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-8 mobile-safe">
        <header className="mb-6 md:mb-8">
          <div className="glass-card rounded-[28px] p-5 md:p-7 border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_22%)]" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.18em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  relatórios
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Sua DRE,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                    muito mais legível.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl leading-relaxed">
                  Veja receitas, despesas e resultado dos últimos 6 meses com uma
                  leitura boa no celular e no desktop.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/5 px-4 py-2.5 rounded-2xl">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-gray-300">
                  Últimos 6 meses
                </span>
              </div>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : dadosDRE.length === 0 ? (
          <div className="glass-card rounded-[28px] p-10 text-center border border-white/5">
            <FileSpreadsheet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Sem dados para relatório
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Cadastre lançamentos e categorias para montar sua DRE e acompanhar o
              resultado do período.
            </p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              <div className="glass-card rounded-[24px] p-5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                      Média mensal de receita
                    </p>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                      {formatarMoeda(resumo.mediaReceita)}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[24px] p-5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                      Média mensal de despesa
                    </p>
                    <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                      {formatarMoeda(resumo.mediaDespesa)}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[24px] p-5 card-hover sm:col-span-2 xl:col-span-1">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp
                      className={`w-5 h-5 ${
                        resumo.mediaResultado >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                      Resultado médio
                    </p>
                    <h2
                      className={`text-2xl md:text-3xl font-black mt-3 ${
                        resumo.mediaResultado >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatarMoeda(resumo.mediaResultado)}
                    </h2>
                  </div>
                </div>
              </div>
            </section>

            <section className="md:hidden space-y-3 mb-6">
              {mesesHeader.map((mes, i) => {
                const receita = totaisReceitaPorMes[i] ?? 0;
                const despesa = totaisDespesaPorMes[i] ?? 0;
                const resultado = resultadoPorMes[i] ?? 0;

                return (
                  <div
                    key={mes.key}
                    className="glass-card rounded-[24px] p-4 border border-white/5"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold">
                          Competência
                        </p>
                        <h3 className="text-lg font-black text-white mt-2">{mes.label}</h3>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-700" />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                          Receita
                        </p>
                        <p className="text-sm font-bold text-emerald-400 mt-2">
                          {formatarMoeda(receita)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                          Despesa
                        </p>
                        <p className="text-sm font-bold text-red-400 mt-2">
                          {formatarMoeda(despesa)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                          Resultado
                        </p>
                        <p
                          className={`text-sm font-bold mt-2 ${
                            resultado >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {formatarMoeda(resultado)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="hidden md:block">
              <div className="glass-card rounded-[28px] overflow-hidden border border-white/5">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/20 border-b border-white/5">
                        <th className="px-6 py-4 font-bold text-gray-400 min-w-[260px]">
                          ESTRUTURA DE CONTAS
                        </th>

                        {mesesHeader.map((mes) => (
                          <th
                            key={mes.key}
                            className="px-4 py-4 font-bold text-gray-400 text-right min-w-[110px]"
                          >
                            {mes.label}
                          </th>
                        ))}

                        <th className="px-6 py-4 font-bold text-emerald-400 text-right min-w-[130px]">
                          ACUMULADO
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/[0.05]">
                      <tr className="bg-emerald-500/5">
                        <td
                          colSpan={mesesHeader.length + 2}
                          className="px-6 py-2 text-[10px] font-black text-emerald-500 uppercase tracking-widest"
                        >
                          1. Receitas Operacionais
                        </td>
                      </tr>

                      {receitas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={mesesHeader.length + 2}
                            className="px-8 py-4 text-gray-500"
                          >
                            Sem receitas no período.
                          </td>
                        </tr>
                      ) : (
                        receitas.map((linha) => (
                          <tr
                            key={`rec-${linha.nome}`}
                            className="hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-8 py-3 text-gray-300">{linha.nome}</td>

                            {linha.valores.map((v, i) => (
                              <td key={i} className="px-4 py-3 text-right text-gray-400">
                                {formatarValorTabela(v)}
                              </td>
                            ))}

                            <td className="px-6 py-3 text-right font-bold text-emerald-400 bg-emerald-500/5">
                              {formatarValorTabela(linha.total)}
                            </td>
                          </tr>
                        ))
                      )}

                      <tr className="bg-emerald-500/10 border-t border-emerald-500/10">
                        <td className="px-6 py-4 font-bold text-emerald-400">
                          TOTAL RECEITAS
                        </td>

                        {totaisReceitaPorMes.map((v, i) => (
                          <td key={i} className="px-4 py-4 text-right font-bold text-emerald-400">
                            {formatarValorTabela(v)}
                          </td>
                        ))}

                        <td className="px-6 py-4 text-right font-black text-emerald-300 bg-emerald-500/10">
                          {formatarValorTabela(
                            totaisReceitaPorMes.reduce((a, b) => a + b, 0)
                          )}
                        </td>
                      </tr>

                      <tr className="bg-red-500/5">
                        <td
                          colSpan={mesesHeader.length + 2}
                          className="px-6 py-2 text-[10px] font-black text-red-500 uppercase tracking-widest"
                        >
                          2. Despesas Administrativas / OPEX
                        </td>
                      </tr>

                      {despesas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={mesesHeader.length + 2}
                            className="px-8 py-4 text-gray-500"
                          >
                            Sem despesas no período.
                          </td>
                        </tr>
                      ) : (
                        despesas.map((linha) => (
                          <tr
                            key={`des-${linha.nome}`}
                            className="hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-8 py-3 text-gray-300">{linha.nome}</td>

                            {linha.valores.map((v, i) => (
                              <td key={i} className="px-4 py-3 text-right text-gray-400">
                                {formatarValorTabela(v)}
                              </td>
                            ))}

                            <td className="px-6 py-3 text-right font-bold text-red-400 bg-red-500/5">
                              {formatarValorTabela(linha.total)}
                            </td>
                          </tr>
                        ))
                      )}

                      <tr className="bg-red-500/10 border-t border-red-500/10">
                        <td className="px-6 py-4 font-bold text-red-400">
                          TOTAL DESPESAS
                        </td>

                        {totaisDespesaPorMes.map((v, i) => (
                          <td key={i} className="px-4 py-4 text-right font-bold text-red-400">
                            {formatarValorTabela(v)}
                          </td>
                        ))}

                        <td className="px-6 py-4 text-right font-black text-red-300 bg-red-500/10">
                          {formatarValorTabela(
                            totaisDespesaPorMes.reduce((a, b) => a + b, 0)
                          )}
                        </td>
                      </tr>

                      <tr className="bg-white/5 border-t-2 border-white/10">
                        <td className="px-6 py-5 font-black text-white text-base">
                          RESULTADO LÍQUIDO
                        </td>

                        {resultadoPorMes.map((res, i) => (
                          <td
                            key={i}
                            className={`px-4 py-5 text-right font-bold text-sm ${
                              res >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {formatarValorTabela(res)}
                          </td>
                        ))}

                        <td className="px-6 py-5 text-right font-black text-lg bg-emerald-500/10 text-white border-l border-white/10">
                          {formatarValorTabela(
                            resultadoPorMes.reduce((a, b) => a + b, 0)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card rounded-[24px] p-5 border border-white/5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                      Receita acumulada
                    </p>
                    <h3 className="text-xl font-black text-white mt-3">
                      {formatarMoeda(resumo.receitaAcumulada)}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[24px] p-5 border border-white/5 card-hover">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                      Despesa acumulada
                    </p>
                    <h3 className="text-xl font-black text-white mt-3">
                      {formatarMoeda(resumo.despesaAcumulada)}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[24px] p-5 border border-white/5 card-hover">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                      resumo.resultadoAcumulado >= 0
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-red-500/10 border-red-500/20"
                    }`}
                  >
                    <Wallet
                      className={`w-5 h-5 ${
                        resumo.resultadoAcumulado >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                      Resultado acumulado
                    </p>
                    <h3
                      className={`text-xl font-black mt-3 ${
                        resumo.resultadoAcumulado >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatarMoeda(resumo.resultadoAcumulado)}
                    </h3>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}