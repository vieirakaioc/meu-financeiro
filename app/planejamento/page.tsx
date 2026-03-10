"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  CalendarDays,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  ChevronRight,
} from "lucide-react";
import {
  gerarProjecaoMensal,
  PlanejamentoItem,
  ContaInvestimentoProj,
} from "../../lib/planejamento";

type Conta = {
  id: string;
  nome: string;
  saldo_atual: number | string | null;
};

type Categoria = {
  id: string;
  nome: string;
  tipo: "receita" | "despesa";
};

type PlanejamentoDb = PlanejamentoItem & {
  category_id?: string | null;
  account_id?: string | null;
  categories?: { nome: string } | null;
  accounts?: { nome: string } | null;
};

type InvestimentoDb = ContaInvestimentoProj & {
  instituicao?: string | null;
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const hoje = new Date();
const getDataLocal = () => {
  const offset = hoje.getTimezoneOffset();
  const local = new Date(hoje.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
};

const parseCurrencyInput = (value: string) => {
  if (!value) return NaN;
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
};

export default function PlanejamentoPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [planejamento, setPlanejamento] = useState<PlanejamentoDb[]>([]);
  const [investimentos, setInvestimentos] = useState<InvestimentoDb[]>([]);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [regraTipo, setRegraTipo] = useState<"unico" | "recorrente" | "parcelado">("recorrente");
  const [valor, setValor] = useState("");
  const [dataInicio, setDataInicio] = useState(getDataLocal());
  const [dataFim, setDataFim] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

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

      const [contasRes, categoriasRes, planejamentoRes, investimentosRes] = await Promise.all([
        supabase.from("accounts").select("id, nome, saldo_atual").eq("user_id", user.id).order("nome"),
        supabase.from("categories").select("id, nome, tipo").eq("user_id", user.id).order("nome"),
        supabase
          .from("planning_entries")
          .select("*, categories:category_id(nome), accounts:account_id(nome)")
          .eq("user_id", user.id)
          .order("data_inicio", { ascending: true }),
        supabase
          .from("investment_accounts")
          .select("*")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .order("nome", { ascending: true }),
      ]);

      if (contasRes.error) throw new Error(contasRes.error.message);
      if (categoriasRes.error) throw new Error(categoriasRes.error.message);
      if (planejamentoRes.error) throw new Error(planejamentoRes.error.message);
      if (investimentosRes.error) throw new Error(investimentosRes.error.message);

      const contasData = (contasRes.data ?? []) as Conta[];
      const categoriasData = (categoriasRes.data ?? []) as Categoria[];
      const planejamentoData = (planejamentoRes.data ?? []) as PlanejamentoDb[];
      const investimentosData = (investimentosRes.data ?? []) as InvestimentoDb[];

      setContas(contasData);
      setCategorias(categoriasData);
      setPlanejamento(planejamentoData);
      setInvestimentos(investimentosData);

      if (contasData.length > 0 && !contaId) setContaId(contasData[0].id);
      const primeiraCategoriaTipo = categoriasData.find((c) => c.tipo === tipo);
      if (primeiraCategoriaTipo && !categoriaId) setCategoriaId(primeiraCategoriaTipo.id);
    } catch (err: any) {
      alert("🛑 Erro ao carregar planejamento: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saldoInicialCaixa = useMemo(
    () => contas.reduce((acc, conta) => acc + Number(conta.saldo_atual ?? 0), 0),
    [contas]
  );

  const linhas = useMemo(() => {
    return gerarProjecaoMensal({
      saldoInicialCaixa,
      planejamento,
      investimentos,
      meses: 60,
      iniciarNoMesSeguinte: true,
    });
  }, [saldoInicialCaixa, planejamento, investimentos]);

  const resumo = useMemo(() => {
    const ultima = linhas[linhas.length - 1];
    const pior = linhas.reduce(
      (acc, row) => (row.saldo_final < acc.saldo_final ? row : acc),
      linhas[0] ?? null
    );
    const primeiraNegativa = linhas.find((row) => row.saldo_final < 0);

    return {
      caixaHoje: saldoInicialCaixa,
      caixaProjetado60: ultima?.saldo_final ?? 0,
      investimentosProjetados60: ultima?.saldo_investimentos ?? 0,
      patrimonioProjetado60: ultima?.patrimonio_total ?? 0,
      piorMes: pior,
      primeiraNegativa,
    };
  }, [linhas, saldoInicialCaixa]);

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.tipo === tipo),
    [categorias, tipo]
  );

  const abrirModal = () => {
    setNome("");
    setTipo("despesa");
    setRegraTipo("recorrente");
    setValor("");
    setDataInicio(getDataLocal());
    setDataFim("");
    setTotalParcelas("");
    setCategoriaId(categorias.find((c) => c.tipo === "despesa")?.id ?? "");
    setContaId(contas[0]?.id ?? "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSalvar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setFormError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFormError("Sessão expirada. Faça login novamente.");
      return;
    }

    const valorNumerico = parseCurrencyInput(valor);

    if (!nome.trim()) return setFormError("Digite o nome do compromisso.");
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0)
      return setFormError("Digite um valor válido maior que zero.");
    if (!dataInicio) return setFormError("Informe a data inicial.");
    if (!categoriaId) return setFormError("Selecione a categoria.");
    if (!contaId) return setFormError("Selecione a conta.");

    if (regraTipo === "recorrente" && dataFim && dataFim < dataInicio) {
      return setFormError("A data final não pode ser menor que a inicial.");
    }

    if (regraTipo === "parcelado") {
      const parcelas = Number(totalParcelas);
      if (!Number.isInteger(parcelas) || parcelas <= 0) {
        return setFormError("Informe a quantidade de parcelas corretamente.");
      }
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.from("planning_entries").insert([
        {
          user_id: user.id,
          nome: nome.trim(),
          tipo,
          regra_tipo: regraTipo,
          valor: valorNumerico,
          category_id: categoriaId,
          account_id: contaId,
          data_inicio: dataInicio,
          data_fim: regraTipo === "recorrente" ? dataFim || null : null,
          total_parcelas: regraTipo === "parcelado" ? Number(totalParcelas) : null,
          ativo: true,
        },
      ]);

      if (error) throw new Error(error.message);

      setIsModalOpen(false);
      await carregarDados();
    } catch (err: any) {
      setFormError(err.message || "Erro ao salvar compromisso.");
    } finally {
      setIsSaving(false);
    }
  };

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
                  planejamento 60 meses
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Seu dinheiro,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                    até 5 anos à frente.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-3xl leading-relaxed">
                  Essa tela projeta seu caixa futuro usando receitas recorrentes, despesas recorrentes,
                  parcelamentos automáticos e aportes mensais em investimentos.
                </p>
              </div>

              <button
                onClick={abrirModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3.5 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                <Plus className="w-5 h-5" />
                Novo compromisso
              </button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <div className="glass-card rounded-[24px] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">Caixa hoje</p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">{formatarMoeda(resumo.caixaHoje)}</h2>
              </div>

              <div className="glass-card rounded-[24px] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">Caixa em 60 meses</p>
                <h2 className={`text-2xl md:text-3xl font-black mt-3 ${resumo.caixaProjetado60 >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatarMoeda(resumo.caixaProjetado60)}
                </h2>
              </div>

              <div className="glass-card rounded-[24px] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">Investimentos em 60 meses</p>
                <h2 className="text-2xl md:text-3xl font-black text-blue-400 mt-3">
                  {formatarMoeda(resumo.investimentosProjetados60)}
                </h2>
              </div>

              <div className="glass-card rounded-[24px] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">Patrimônio em 60 meses</p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {formatarMoeda(resumo.patrimonioProjetado60)}
                </h2>
              </div>
            </section>

            {resumo.primeiraNegativa && (
              <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                Atenção: seu caixa fica negativo pela primeira vez em{" "}
                <strong>{resumo.primeiraNegativa.rotulo}</strong>, fechando em{" "}
                <strong>{formatarMoeda(resumo.primeiraNegativa.saldo_final)}</strong>.
              </div>
            )}

            <section className="md:hidden space-y-3 mb-6">
              {linhas.map((row) => (
                <div key={row.chave} className="glass-card rounded-[24px] p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-semibold">Mês</p>
                      <h3 className="text-lg font-black text-white mt-2">{row.rotulo}</h3>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InfoCard label="Entradas" valor={formatarMoeda(row.entradas)} color="text-emerald-400" />
                    <InfoCard label="Saídas" valor={formatarMoeda(row.saidas_totais)} color="text-red-400" />
                    <InfoCard label="Caixa final" valor={formatarMoeda(row.saldo_final)} color={row.saldo_final >= 0 ? "text-white" : "text-red-400"} />
                    <InfoCard label="Investimentos" valor={formatarMoeda(row.saldo_investimentos)} color="text-blue-400" />
                  </div>
                </div>
              ))}
            </section>

            <section className="hidden md:block mb-6">
              <div className="glass-card rounded-[28px] overflow-hidden border border-white/5">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm whitespace-nowrap">
                    <thead className="bg-black/20 border-b border-white/5">
                      <tr>
                        <th className="px-4 py-4 text-left text-gray-400">Mês</th>
                        <th className="px-4 py-4 text-right text-gray-400">Saldo Inicial</th>
                        <th className="px-4 py-4 text-right text-gray-400">Entradas</th>
                        <th className="px-4 py-4 text-right text-gray-400">Saídas</th>
                        <th className="px-4 py-4 text-right text-gray-400">Caixa Final</th>
                        <th className="px-4 py-4 text-right text-gray-400">Investimentos</th>
                        <th className="px-4 py-4 text-right text-gray-400">Patrimônio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {linhas.map((row) => (
                        <tr key={row.chave} className="hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3 text-white font-semibold">{row.rotulo}</td>
                          <td className="px-4 py-3 text-right text-gray-300">{formatarMoeda(row.saldo_inicial)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">{formatarMoeda(row.entradas)}</td>
                          <td className="px-4 py-3 text-right text-red-400">{formatarMoeda(row.saidas_totais)}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${row.saldo_final >= 0 ? "text-white" : "text-red-400"}`}>
                            {formatarMoeda(row.saldo_final)}
                          </td>
                          <td className="px-4 py-3 text-right text-blue-400">{formatarMoeda(row.saldo_investimentos)}</td>
                          <td className="px-4 py-3 text-right text-white font-bold">{formatarMoeda(row.patrimonio_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-xl font-black">Compromissos cadastrados</h3>
                <span className="text-sm text-gray-500">{planejamento.length} itens</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {planejamento.map((item) => (
                  <div key={item.id} className="glass-card rounded-[24px] p-4 border border-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-white font-bold truncate">{item.nome}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.categories?.nome || "Sem categoria"} • {item.accounts?.nome || "Sem conta"}
                        </p>
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        item.tipo === "receita"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                          : "bg-red-500/10 text-red-400 border-red-500/15"
                      }`}>
                        {item.tipo}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <InfoCard label="Valor" valor={formatarMoeda(Number(item.valor ?? 0))} color="text-white" />
                      <InfoCard label="Regra" valor={item.regra_tipo} color="text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="w-full md:max-w-lg glass-card-strong rounded-t-[30px] md:rounded-[30px] border border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="sticky top-0 z-10 bg-[#0d1420]/90 backdrop-blur-xl border-b border-white/5">
                <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-3 md:hidden" />
                <div className="flex justify-between items-center p-5 md:p-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Novo compromisso</h2>
                    <p className="text-xs text-gray-500 mt-1">Receita, despesa, recorrência ou parcelamento</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-full text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar">
                <form id="novo-compromisso-form" onSubmit={handleSalvar} className="space-y-5">
                  <div className="flex p-1 bg-black/20 rounded-2xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setTipo("despesa");
                        setCategoriaId(categorias.find((c) => c.tipo === "despesa")?.id ?? "");
                      }}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold ${tipo === "despesa" ? "bg-red-500/10 text-red-400" : "text-gray-500"}`}
                    >
                      Despesa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipo("receita");
                        setCategoriaId(categorias.find((c) => c.tipo === "receita")?.id ?? "");
                      }}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold ${tipo === "receita" ? "bg-emerald-500/10 text-emerald-400" : "text-gray-500"}`}
                    >
                      Receita
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["unico", "recorrente", "parcelado"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRegraTipo(r)}
                        className={`py-3 rounded-2xl text-sm font-bold border ${
                          regraTipo === r
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-black/20 text-gray-400 border-white/5"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome do compromisso"
                    className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Valor"
                    className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none [color-scheme:dark]"
                    />
                    <select
                      value={categoriaId}
                      onChange={(e) => setCategoriaId(e.target.value)}
                      className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none"
                    >
                      <option value="">Selecione a categoria</option>
                      {categoriasFiltradas.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={contaId}
                    onChange={(e) => setContaId(e.target.value)}
                    className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none"
                  >
                    <option value="">Selecione a conta</option>
                    {contas.map((conta) => (
                      <option key={conta.id} value={conta.id}>{conta.nome}</option>
                    ))}
                  </select>

                  {regraTipo === "recorrente" && (
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none [color-scheme:dark]"
                    />
                  )}

                  {regraTipo === "parcelado" && (
                    <input
                      type="number"
                      min="1"
                      value={totalParcelas}
                      onChange={(e) => setTotalParcelas(e.target.value)}
                      placeholder="Quantidade de parcelas"
                      className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none"
                    />
                  )}

                  {formError && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-5 md:p-6 border-t border-white/5 bg-[#0d1420]/80 backdrop-blur-xl sticky bottom-0 z-10">
                <button
                  type="submit"
                  form="novo-compromisso-form"
                  disabled={isSaving}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-105 text-gray-950 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar compromisso"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoCard({
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
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
      <p className={`text-sm font-bold mt-2 ${color}`}>{valor}</p>
    </div>
  );
}