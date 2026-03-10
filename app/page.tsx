"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../components/Sidebar";
import { supabase } from "../lib/supabase";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Wallet,
  TrendingUp,
  Landmark,
  CalendarDays,
  Sparkles,
  Receipt,
  ChevronRight,
  PiggyBank,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  gerarProjecaoMensal,
  type PlanejamentoItem,
  type ContaInvestimentoProj,
  type LinhaProjecao,
} from "../lib/planejamento";

type Conta = {
  id: string;
  nome: string;
  saldo_atual: number | string | null;
};

type Investimento = ContaInvestimentoProj & {
  instituicao?: string | null;
};

type LancamentoRecenteRow = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number | string;
  data_lancamento: string;
  accounts?: { nome: string }[] | null;
  categories?: { nome: string; cor?: string | null }[] | null;
};

type LancamentoRecente = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number | string;
  data_lancamento: string;
  accounts?: { nome: string } | null;
  categories?: { nome: string; cor?: string | null } | null;
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const formatarData = (data: string) =>
  new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");

const formatarCompacto = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(valor);

export default function DashboardPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);

  const [contas, setContas] = useState<Conta[]>([]);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [planejamento, setPlanejamento] = useState<PlanejamentoItem[]>([]);
  const [ultimosLancamentos, setUltimosLancamentos] = useState<LancamentoRecente[]>([]);

  const [receitasMes, setReceitasMes] = useState(0);
  const [despesasMes, setDespesasMes] = useState(0);
  const [resultadoMes, setResultadoMes] = useState(0);

  useEffect(() => {
    const carregarDashboard = async () => {
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

        const hoje = new Date();
        const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
          .toISOString()
          .split("T")[0];
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];

        const [
          contasRes,
          investimentosRes,
          planejamentoRes,
          transacoesMesRes,
          transacoesRecentesRes,
        ] = await Promise.all([
          supabase
            .from("accounts")
            .select("id, nome, saldo_atual")
            .eq("user_id", user.id)
            .order("nome", { ascending: true }),

          supabase
            .from("investment_accounts")
            .select("id, nome, saldo_atual, aporte_mensal, rentabilidade_mensal, ativo, instituicao")
            .eq("user_id", user.id)
            .eq("ativo", true)
            .order("nome", { ascending: true }),

          supabase
            .from("planning_entries")
            .select("id, nome, tipo, regra_tipo, valor, data_inicio, data_fim, total_parcelas, ativo")
            .eq("user_id", user.id)
            .eq("ativo", true),

          supabase
            .from("transactions")
            .select("id, tipo, valor, data_lancamento")
            .eq("user_id", user.id)
            .gte("data_lancamento", primeiroDiaMes)
            .lte("data_lancamento", ultimoDiaMes),

          supabase
            .from("transactions")
            .select("id, tipo, descricao, valor, data_lancamento, accounts:account_id(nome), categories:category_id(nome, cor)")
            .eq("user_id", user.id)
            .order("data_lancamento", { ascending: false })
            .limit(7),
        ]);

        if (contasRes.error) throw new Error(contasRes.error.message);
        if (investimentosRes.error) throw new Error(investimentosRes.error.message);
        if (planejamentoRes.error) throw new Error(planejamentoRes.error.message);
        if (transacoesMesRes.error) throw new Error(transacoesMesRes.error.message);
        if (transacoesRecentesRes.error) throw new Error(transacoesRecentesRes.error.message);

        const contasData = (contasRes.data ?? []) as Conta[];
        const investimentosData = (investimentosRes.data ?? []) as Investimento[];
        const planejamentoData = (planejamentoRes.data ?? []) as PlanejamentoItem[];
        const transacoesMes = (transacoesMesRes.data ?? []) as Array<{
          id: string;
          tipo: "receita" | "despesa";
          valor: number | string;
          data_lancamento: string;
        }>;
        const recentesRows = (transacoesRecentesRes.data ?? []) as unknown as LancamentoRecenteRow[];

        const recentesData: LancamentoRecente[] = recentesRows.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          descricao: item.descricao,
          valor: item.valor,
          data_lancamento: item.data_lancamento,
          accounts: item.accounts?.[0] ?? null,
          categories: item.categories?.[0] ?? null,
        }));

        setContas(contasData);
        setInvestimentos(investimentosData);
        setPlanejamento(planejamentoData);
        setUltimosLancamentos(recentesData);

        let totalReceitas = 0;
        let totalDespesas = 0;

        transacoesMes.forEach((item) => {
          const valor = Number(item.valor ?? 0);
          if (item.tipo === "receita") totalReceitas += valor;
          if (item.tipo === "despesa") totalDespesas += valor;
        });

        setReceitasMes(totalReceitas);
        setDespesasMes(totalDespesas);
        setResultadoMes(totalReceitas - totalDespesas);
      } catch (err: any) {
        alert("🛑 Erro ao carregar dashboard: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    carregarDashboard();
  }, [router]);

  const saldoCaixaAtual = useMemo(
    () => contas.reduce((acc, conta) => acc + Number(conta.saldo_atual ?? 0), 0),
    [contas]
  );

  const saldoInvestidoAtual = useMemo(
    () => investimentos.reduce((acc, inv) => acc + Number(inv.saldo_atual ?? 0), 0),
    [investimentos]
  );

  const patrimonioAtual = saldoCaixaAtual + saldoInvestidoAtual;

  const linhasProjecao = useMemo<LinhaProjecao[]>(() => {
    return gerarProjecaoMensal({
      saldoInicialCaixa: saldoCaixaAtual,
      planejamento,
      investimentos,
      meses: 60,
      iniciarNoMesSeguinte: true,
    });
  }, [saldoCaixaAtual, planejamento, investimentos]);

  const projecao12Meses = linhasProjecao[11] ?? null;
  const projecao60Meses = linhasProjecao[59] ?? linhasProjecao[linhasProjecao.length - 1] ?? null;

  const piorMes = useMemo(() => {
    if (!linhasProjecao.length) return null;
    return linhasProjecao.reduce((pior, atual) =>
      atual.saldo_final < pior.saldo_final ? atual : pior
    );
  }, [linhasProjecao]);

  const primeiraNegativa = useMemo(() => {
    return linhasProjecao.find((linha) => linha.saldo_final < 0) ?? null;
  }, [linhasProjecao]);

  const dadosGrafico = useMemo(() => linhasProjecao.slice(0, 12), [linhasProjecao]);
  const tabela12Meses = useMemo(() => linhasProjecao.slice(0, 12), [linhasProjecao]);

  return (
    <div className="min-h-screen text-gray-100 flex font-sans no-tap-highlight">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-8 mobile-safe">
        <header className="mb-6 md:mb-8">
          <div className="glass-card rounded-[28px] p-5 md:p-7 border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_24%)]" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.18em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  visão geral + futuro
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Seu dinheiro,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                    hoje e daqui 5 anos.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-3xl leading-relaxed">
                  Aqui você enxerga o caixa atual, o patrimônio investido e a projeção
                  financeira dos próximos 60 meses.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="glass-card-strong rounded-2xl px-4 py-3 min-w-[160px]">
                  <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest">
                    <CalendarDays className="w-4 h-4 text-emerald-400" />
                    Próx. 12 meses
                  </div>
                  <p className="text-sm md:text-base text-white font-semibold mt-2">
                    {projecao12Meses ? formatarMoeda(projecao12Meses.saldo_final) : "-"}
                  </p>
                </div>

                <div className="glass-card-strong rounded-2xl px-4 py-3 min-w-[160px]">
                  <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest">
                    <PiggyBank className="w-4 h-4 text-blue-400" />
                    Patrimônio 60m
                  </div>
                  <p className="text-sm md:text-base text-white font-semibold mt-2">
                    {projecao60Meses ? formatarMoeda(projecao60Meses.patrimonio_total) : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="space-y-5 md:space-y-6">
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
              <ResumoCard
                label="Caixa atual"
                valor={formatarMoeda(saldoCaixaAtual)}
                icon={<Wallet className="w-5 h-5 text-blue-400" />}
                help="Soma das contas correntes e carteiras."
              />

              <ResumoCard
                label="Investido hoje"
                valor={formatarMoeda(saldoInvestidoAtual)}
                icon={<PiggyBank className="w-5 h-5 text-emerald-400" />}
                help="Saldo atual das contas de investimento."
              />

              <ResumoCard
                label="Patrimônio atual"
                valor={formatarMoeda(patrimonioAtual)}
                icon={<Landmark className="w-5 h-5 text-white" />}
                help="Caixa + investimentos."
              />

              <ResumoCard
                label="Receitas do mês"
                valor={formatarMoeda(receitasMes)}
                icon={<ArrowUpCircle className="w-5 h-5 text-emerald-400" />}
                help="Tudo que entrou neste mês."
                color="text-emerald-400"
              />

              <ResumoCard
                label="Despesas do mês"
                valor={formatarMoeda(despesasMes)}
                icon={<ArrowDownCircle className="w-5 h-5 text-red-400" />}
                help="Tudo que saiu neste mês."
                color="text-red-400"
              />

              <ResumoCard
                label="Resultado do mês"
                valor={formatarMoeda(resultadoMes)}
                icon={
                  <TrendingUp
                    className={`w-5 h-5 ${
                      resultadoMes >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  />
                }
                help="Receitas menos despesas do mês atual."
                color={resultadoMes >= 0 ? "text-emerald-400" : "text-red-400"}
              />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-5 md:gap-6">
              <div className="glass-card rounded-[28px] p-4 md:p-6 min-h-[350px] md:min-h-[420px]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-white text-lg md:text-xl font-bold">
                      Projeção patrimonial dos próximos 12 meses
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Linha azul = patrimônio total. Linha verde = caixa projetado.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-gray-500 uppercase tracking-widest">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      Patrimônio
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Caixa
                    </span>
                  </div>
                </div>

                <div className="h-[260px] md:h-[320px]">
                  {dadosGrafico.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center px-6">
                      <div>
                        <p className="text-white font-semibold">Sem projeção ainda</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Cadastre compromissos no Planejamento e investimentos para gerar o futuro.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={dadosGrafico}
                        margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="patrimonioArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="caixaArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#34d399" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          strokeDasharray="4 4"
                          stroke="rgba(148, 163, 184, 0.12)"
                          vertical={false}
                        />

                        <XAxis
                          dataKey="rotulo"
                          stroke="#64748b"
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                        />

                        <YAxis
                          stroke="#64748b"
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          tickFormatter={(value) => formatarCompacto(Number(value))}
                        />

                        <Tooltip content={<ProjectionTooltip />} />

                        <Area
                          type="monotone"
                          dataKey="patrimonio_total"
                          stroke="#60a5fa"
                          strokeWidth={3}
                          fill="url(#patrimonioArea)"
                        />

                        <Area
                          type="monotone"
                          dataKey="saldo_final"
                          stroke="#34d399"
                          strokeWidth={2.5}
                          fill="url(#caixaArea)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <AlertaCard
                  title="Caixa em 12 meses"
                  value={projecao12Meses ? formatarMoeda(projecao12Meses.saldo_final) : "-"}
                  subtitle={
                    projecao12Meses
                      ? `Fechamento previsto em ${projecao12Meses.rotulo}.`
                      : "Sem dados suficientes."
                  }
                  positive={!!projecao12Meses && projecao12Meses.saldo_final >= 0}
                />

                <AlertaCard
                  title="Patrimônio em 60 meses"
                  value={
                    projecao60Meses ? formatarMoeda(projecao60Meses.patrimonio_total) : "-"
                  }
                  subtitle="Caixa projetado + investimentos projetados."
                  positive
                />

                <AlertaCard
                  title="Pior mês de caixa"
                  value={piorMes ? `${piorMes.rotulo} • ${formatarMoeda(piorMes.saldo_final)}` : "-"}
                  subtitle="Menor saldo final dentro da projeção."
                  positive={!piorMes || piorMes.saldo_final >= 0}
                />

                <div
                  className={`glass-card rounded-[26px] p-5 border ${
                    primeiraNegativa
                      ? "border-red-500/20 bg-red-500/[0.05]"
                      : "border-emerald-500/20 bg-emerald-500/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                        primeiraNegativa
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-emerald-500/10 border-emerald-500/20"
                      }`}
                    >
                      {primeiraNegativa ? (
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                        Alerta de caixa
                      </p>

                      <h3
                        className={`text-lg font-black mt-3 ${
                          primeiraNegativa ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {primeiraNegativa
                          ? `Negativo em ${primeiraNegativa.rotulo}`
                          : "Sem aperto de caixa"}
                      </h3>

                      <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                        {primeiraNegativa
                          ? `Seu caixa fica negativo pela primeira vez em ${primeiraNegativa.rotulo}, fechando em ${formatarMoeda(
                              primeiraNegativa.saldo_final
                            )}.`
                          : "Pela projeção atual, seu caixa não fica negativo nos próximos 60 meses."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-5 md:gap-6">
              <div className="glass-card rounded-[28px] p-4 md:p-6 border border-white/5">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-white text-lg md:text-xl font-bold">
                      Próximos 12 meses
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Como o caixa e o patrimônio devem evoluir.
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <section className="md:hidden space-y-3">
                  {tabela12Meses.map((row) => (
                    <div
                      key={row.chave}
                      className="rounded-[22px] border border-white/5 bg-black/20 p-4"
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold">
                            Mês
                          </p>
                          <h4 className="text-lg font-black text-white mt-2">{row.rotulo}</h4>
                        </div>

                        <ChevronRight className="w-4 h-4 text-gray-700" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <InfoMini label="Entradas" valor={formatarMoeda(row.entradas)} color="text-emerald-400" />
                        <InfoMini label="Saídas" valor={formatarMoeda(row.saidas_totais)} color="text-red-400" />
                        <InfoMini
                          label="Caixa final"
                          valor={formatarMoeda(row.saldo_final)}
                          color={row.saldo_final >= 0 ? "text-white" : "text-red-400"}
                        />
                        <InfoMini
                          label="Patrimônio"
                          valor={formatarMoeda(row.patrimonio_total)}
                          color="text-blue-400"
                        />
                      </div>
                    </div>
                  ))}
                </section>

                <section className="hidden md:block">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm whitespace-nowrap">
                      <thead className="border-b border-white/5">
                        <tr className="text-gray-400">
                          <th className="px-3 py-3 text-left">Mês</th>
                          <th className="px-3 py-3 text-right">Entradas</th>
                          <th className="px-3 py-3 text-right">Saídas</th>
                          <th className="px-3 py-3 text-right">Caixa Final</th>
                          <th className="px-3 py-3 text-right">Patrimônio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {tabela12Meses.map((row) => (
                          <tr key={row.chave} className="hover:bg-white/[0.03] transition-colors">
                            <td className="px-3 py-3 text-white font-semibold">{row.rotulo}</td>
                            <td className="px-3 py-3 text-right text-emerald-400">
                              {formatarMoeda(row.entradas)}
                            </td>
                            <td className="px-3 py-3 text-right text-red-400">
                              {formatarMoeda(row.saidas_totais)}
                            </td>
                            <td
                              className={`px-3 py-3 text-right font-semibold ${
                                row.saldo_final >= 0 ? "text-white" : "text-red-400"
                              }`}
                            >
                              {formatarMoeda(row.saldo_final)}
                            </td>
                            <td className="px-3 py-3 text-right text-blue-400 font-semibold">
                              {formatarMoeda(row.patrimonio_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="glass-card rounded-[28px] p-4 md:p-6 border border-white/5">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="text-white text-lg md:text-xl font-bold">
                      Transações recentes
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Últimas movimentações registradas.
                    </p>
                  </div>

                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <div className="space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                  {ultimosLancamentos.length === 0 ? (
                    <div className="rounded-3xl border border-white/5 bg-black/20 p-6 text-center">
                      <p className="text-white font-semibold">Sem movimentações ainda</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Seus lançamentos vão aparecer aqui.
                      </p>
                    </div>
                  ) : (
                    ultimosLancamentos.map((lanc) => (
                      <div
                        key={lanc.id}
                        className="rounded-[22px] border border-white/5 bg-black/20 hover:bg-black/30 transition-colors p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${lanc.categories?.cor || "#64748b"}20`,
                              border: `1px solid ${lanc.categories?.cor || "#64748b"}30`,
                            }}
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: lanc.categories?.cor || "#64748b",
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm md:text-[15px] text-white font-semibold truncate">
                                  {lanc.descricao}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                  {lanc.accounts?.nome || "Conta apagada"} •{" "}
                                  {lanc.categories?.nome || "Sem categoria"}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <p
                                  className={`text-sm font-bold ${
                                    lanc.tipo === "receita"
                                      ? "text-emerald-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  {lanc.tipo === "receita" ? "+" : "-"}{" "}
                                  {formatarMoeda(Number(lanc.valor))}
                                </p>
                                <p className="text-[11px] text-gray-600 mt-1">
                                  {formatarData(lanc.data_lancamento)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold ${
                                  lanc.tipo === "receita"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                                    : "bg-red-500/10 text-red-400 border border-red-500/15"
                                }`}
                              >
                                {lanc.tipo === "receita" ? (
                                  <ArrowUpCircle className="w-3 h-3" />
                                ) : (
                                  <ArrowDownCircle className="w-3 h-3" />
                                )}
                                {lanc.tipo}
                              </span>

                              <ChevronRight className="w-4 h-4 text-gray-700" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function ResumoCard({
  label,
  valor,
  icon,
  help,
  color = "text-white",
}: {
  label: string;
  valor: string;
  icon: React.ReactNode;
  help: string;
  color?: string;
}) {
  return (
    <div className="glass-card rounded-[26px] p-5 md:p-6 card-hover">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
            {label}
          </p>
          <h2 className={`text-2xl md:text-3xl font-black mt-3 leading-none ${color}`}>
            {valor}
          </h2>
          <p className="text-xs text-gray-500 mt-3">{help}</p>
        </div>

        <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}

function AlertaCard({
  title,
  value,
  subtitle,
  positive,
}: {
  title: string;
  value: string;
  subtitle: string;
  positive: boolean;
}) {
  return (
    <div
      className={`glass-card rounded-[26px] p-5 border ${
        positive ? "border-emerald-500/10" : "border-red-500/10"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
        {title}
      </p>
      <h3 className={`text-xl font-black mt-3 ${positive ? "text-white" : "text-red-400"}`}>
        {value}
      </h3>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">{subtitle}</p>
    </div>
  );
}

function InfoMini({
  label,
  valor,
  color,
}: {
  label: string;
  valor: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
        {label}
      </p>
      <p className={`text-sm font-bold mt-2 ${color}`}>{valor}</p>
    </div>
  );
}

function ProjectionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const mapa: Record<string, string> = {
    patrimonio_total: "Patrimônio total",
    saldo_final: "Caixa final",
  };

  return (
    <div
      style={{
        background: "rgba(2, 6, 23, 0.94)",
        border: "1px solid rgba(148, 163, 184, 0.14)",
        borderRadius: 18,
        color: "#fff",
        boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
        padding: 12,
      }}
    >
      <p className="text-sm font-semibold mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={index} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-gray-400">{mapa[String(item.name ?? "")] ?? String(item.name ?? "")}</span>
            <span className="font-semibold text-white">
              {formatarMoeda(Number(item.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}