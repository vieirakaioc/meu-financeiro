"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  PieChart,
  Plus,
  X,
  Loader2,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Wallet,
  TriangleAlert,
  ChartNoAxesColumn,
  Sparkles,
  ChevronRight,
} from "lucide-react";

type Usuario = {
  id: string;
};

type Categoria = {
  id: string;
  nome: string;
  cor: string | null;
  tipo: "despesa" | "receita";
};

type OrcamentoDb = {
  id: string;
  category_id: string;
  valor_orcado: number | string;
  mes: number;
  ano: number;
};

type Transacao = {
  category_id: string;
  valor: number | string;
};

type OrcamentoConsolidado = {
  id: string;
  category_id: string;
  categoria_nome: string;
  cor: string;
  orcado: number;
  realizado: number;
  saldo_restante: number;
  percentual: number;
  percentualReal: number;
  estourou: boolean;
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const parseCurrencyInput = (value: string) => {
  if (!value) return NaN;

  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized);
};

export default function OrcamentoPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [user, setUser] = useState<Usuario | null>(null);
  const [categoriasDespesa, setCategoriasDespesa] = useState<Categoria[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoConsolidado[]>([]);

  const [categoriaId, setCategoriaId] = useState("");
  const [valorOrcado, setValorOrcado] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const hoje = useMemo(() => new Date(), []);
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const nomeMesAtual = useMemo(() => {
    return hoje.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  }, [hoje]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
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

      const primeiroDiaMes = new Date(anoAtual, mesAtual - 1, 1).toISOString().split("T")[0];
      const ultimoDiaMes = new Date(anoAtual, mesAtual, 0).toISOString().split("T")[0];

      const [categoriasRes, orcamentosRes, transacoesRes] = await Promise.all([
        supabase
          .from("categories")
          .select("*")
          .eq("user_id", user.id)
          .eq("tipo", "despesa")
          .order("nome", { ascending: true }),

        supabase
          .from("budgets")
          .select("*")
          .eq("user_id", user.id)
          .eq("mes", mesAtual)
          .eq("ano", anoAtual),

        supabase
          .from("transactions")
          .select("category_id, valor")
          .eq("user_id", user.id)
          .eq("tipo", "despesa")
          .gte("data_lancamento", primeiroDiaMes)
          .lte("data_lancamento", ultimoDiaMes),
      ]);

      if (categoriasRes.error) throw new Error(categoriasRes.error.message);
      if (orcamentosRes.error) throw new Error(orcamentosRes.error.message);
      if (transacoesRes.error) throw new Error(transacoesRes.error.message);

      const categorias = (categoriasRes.data ?? []) as Categoria[];
      const orcamentosDb = (orcamentosRes.data ?? []) as OrcamentoDb[];
      const transacoes = (transacoesRes.data ?? []) as Transacao[];

      const consolidado: OrcamentoConsolidado[] = orcamentosDb.map((orcamento) => {
        const categoria = categorias.find((c) => c.id === orcamento.category_id);

        const realizado = transacoes
          .filter((t) => t.category_id === orcamento.category_id)
          .reduce((acc, t) => acc + Number(t.valor ?? 0), 0);

        const orcado = Number(orcamento.valor_orcado ?? 0);
        const percentualReal = orcado > 0 ? (realizado / orcado) * 100 : 0;

        return {
          id: orcamento.id,
          category_id: orcamento.category_id,
          categoria_nome: categoria?.nome || "Categoria",
          cor: categoria?.cor || "#6b7280",
          orcado,
          realizado,
          saldo_restante: orcado - realizado,
          percentual: Math.min(percentualReal, 100),
          percentualReal,
          estourou: percentualReal > 100,
        };
      });

      consolidado.sort((a, b) => a.categoria_nome.localeCompare(b.categoria_nome));

      setCategoriasDespesa(categorias);
      setOrcamentos(consolidado);

      const categoriasSemOrcamento = categorias.filter(
        (categoria) => !orcamentosDb.some((orc) => orc.category_id === categoria.id)
      );

      if (!categoriaId) {
        setCategoriaId(categoriasSemOrcamento[0]?.id ?? "");
      }
    } catch (err: any) {
      alert("🛑 Erro ao carregar orçamento: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModal = () => {
    const categoriasDisponiveis = categoriasDespesa.filter(
      (categoria) => !orcamentos.some((orc) => orc.category_id === categoria.id)
    );

    setCategoriaId(categoriasDisponiveis[0]?.id ?? "");
    setValorOrcado("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSalvar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSaving) return;
    if (!user) {
      setFormError("Sistema perdeu o login. Entre novamente.");
      return;
    }

    if (!categoriaId) {
      setFormError("Selecione a categoria.");
      return;
    }

    const valorNumerico = parseCurrencyInput(valorOrcado);

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setFormError("Digite um valor de orçamento válido maior que zero.");
      return;
    }

    const categoriaJaOrcada = orcamentos.some((orc) => orc.category_id === categoriaId);
    if (categoriaJaOrcada) {
      setFormError("Essa categoria já possui orçamento definido neste mês.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const { error } = await supabase.from("budgets").insert([
        {
          user_id: user.id,
          category_id: categoriaId,
          mes: mesAtual,
          ano: anoAtual,
          valor_orcado: valorNumerico,
        },
      ]);

      if (error) throw new Error(error.message);

      await carregarDados();
      setIsModalOpen(false);
      setCategoriaId("");
      setValorOrcado("");
    } catch (err: any) {
      setFormError(err.message || "Erro ao salvar orçamento.");
    } finally {
      setIsSaving(false);
    }
  };

  const categoriasDisponiveis = useMemo(() => {
    return categoriasDespesa.filter(
      (categoria) => !orcamentos.some((orc) => orc.category_id === categoria.id)
    );
  }, [categoriasDespesa, orcamentos]);

  const resumo = useMemo(() => {
    const totalOrcado = orcamentos.reduce((acc, item) => acc + item.orcado, 0);
    const totalRealizado = orcamentos.reduce((acc, item) => acc + item.realizado, 0);
    const estourados = orcamentos.filter((item) => item.estourou).length;
    const saldoRestante = totalOrcado - totalRealizado;

    return {
      totalOrcado,
      totalRealizado,
      estourados,
      saldoRestante,
    };
  }, [orcamentos]);

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
                  orçamento
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Gasto planejado,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                    gasto controlado.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl leading-relaxed capitalize">
                  Compare o que foi planejado com o que já saiu no mês de {nomeMesAtual}.
                </p>
              </div>

              <button
                onClick={abrirModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3.5 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                <Plus className="w-5 h-5" />
                Definir teto
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Total orçado
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {formatarMoeda(resumo.totalOrcado)}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <PieChart className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Total realizado
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {formatarMoeda(resumo.totalRealizado)}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Saldo restante
                </p>
                <h2
                  className={`text-2xl md:text-3xl font-black mt-3 ${
                    resumo.saldoRestante >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatarMoeda(resumo.saldoRestante)}
                </h2>
              </div>

              <div
                className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                  resumo.saldoRestante >= 0
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-red-500/10 border-red-500/20"
                }`}
              >
                <CheckCircle2
                  className={`w-5 h-5 ${
                    resumo.saldoRestante >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Estourados
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-red-400 mt-3">
                  {resumo.estourados}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <TriangleAlert className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="glass-card rounded-[28px] p-10 text-center border border-white/5">
            <TrendingDown className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Nenhum orçamento definido
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Defina limites por categoria para acompanhar seus gastos mensais com clareza.
            </p>

            <button
              onClick={abrirModal}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              <Plus className="w-5 h-5" />
              Definir teto
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {orcamentos.map((orc) => (
              <div
                key={orc.id}
                className="glass-card rounded-[26px] p-5 md:p-6 border border-white/5 card-hover"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${orc.cor}20`,
                        border: `1px solid ${orc.cor}30`,
                      }}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: orc.cor }}
                      />
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">
                        {orc.categoria_nome}
                      </h3>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold mt-2">
                        Categoria orçada
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border shrink-0 ${
                      orc.estourou
                        ? "bg-red-500/10 text-red-400 border-red-500/15"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                    }`}
                  >
                    {orc.estourou ? "Estourou" : "Dentro do limite"}
                  </span>
                </div>

                <div className="mt-5 rounded-[22px] bg-black/20 border border-white/5 p-4">
                  <div className="flex justify-between items-end gap-4 mb-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                        Gasto atual
                      </p>
                      <p
                        className={`text-3xl font-black mt-3 leading-none ${
                          orc.estourou ? "text-red-400" : "text-white"
                        }`}
                      >
                        {formatarMoeda(orc.realizado)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                        Teto
                      </p>
                      <p className="text-sm font-semibold text-gray-300 mt-3">
                        {formatarMoeda(orc.orcado)}
                      </p>
                    </div>
                  </div>

                  <div className="w-full bg-white/[0.04] rounded-full h-3 overflow-hidden border border-white/5">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${
                        orc.estourou ? "bg-red-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${orc.percentual}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center gap-4 mt-3 text-xs">
                    <span className="text-gray-500">
                      Uso{" "}
                      <span className={orc.estourou ? "text-red-400" : "text-gray-300"}>
                        {orc.percentualReal.toFixed(1)}%
                      </span>
                    </span>

                    <span className="text-gray-500">
                      Saldo{" "}
                      <span
                        className={
                          orc.saldo_restante >= 0 ? "text-emerald-400" : "text-red-400"
                        }
                      >
                        {formatarMoeda(orc.saldo_restante)}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>Controle mensal</span>
                  <ChevronRight className="w-4 h-4 text-gray-700" />
                </div>
              </div>
            ))}
          </section>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="w-full md:max-w-md glass-card-strong rounded-t-[30px] md:rounded-[30px] border border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="sticky top-0 z-10 bg-[#0d1420]/90 backdrop-blur-xl border-b border-white/5">
                <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-3 md:hidden" />

                <div className="flex justify-between items-center p-5 md:p-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Definir orçamento</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Escolha uma categoria e defina o teto do mês
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setFormError(null);
                    }}
                    className="p-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-full text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar">
                {categoriasDisponiveis.length === 0 ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Todas as categorias de despesa já possuem orçamento definido neste mês.
                  </div>
                ) : (
                  <form id="orcamento-form" onSubmit={handleSalvar} className="space-y-6">
                    <div className="rounded-[24px] bg-black/20 border border-white/5 p-5 text-center">
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3">
                        Teto mensal
                      </label>

                      <div className="flex items-center justify-center text-4xl md:text-5xl font-black text-white">
                        <span className="text-xl md:text-2xl text-gray-500 mr-2">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          value={valorOrcado}
                          onChange={(e) => setValorOrcado(e.target.value)}
                          placeholder="0,00"
                          className="bg-transparent border-none outline-none text-center w-44 md:w-52 placeholder-gray-800 focus:ring-0 p-0"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="relative">
                      <select
                        required
                        value={categoriaId}
                        onChange={(e) => setCategoriaId(e.target.value)}
                        className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 appearance-none"
                      >
                        <option value="" disabled>
                          Selecione a categoria...
                        </option>
                        {categoriasDisponiveis.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {formError && (
                      <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}
                  </form>
                )}
              </div>

              {categoriasDisponiveis.length > 0 && (
                <div className="p-5 md:p-6 border-t border-white/5 bg-[#0d1420]/80 backdrop-blur-xl sticky bottom-0 z-10">
                  <button
                    type="submit"
                    form="orcamento-form"
                    disabled={isSaving}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-105 text-gray-950 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving ? "Salvando..." : "Confirmar teto"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}