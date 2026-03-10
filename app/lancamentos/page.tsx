"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import { inferirCategoriaId } from "../../lib/classificador";
import {
  Plus,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  Loader2,
  Calendar,
  Wallet,
  Tag,
  AlertCircle,
  Receipt,
  Landmark,
  Sparkles,
  ChevronRight,
} from "lucide-react";

type TipoLancamento = "despesa" | "receita";

type Conta = {
  id: string;
  nome: string;
  saldo_inicial: number | string | null;
  saldo_atual: number | string | null;
};

type Categoria = {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  cor?: string | null;
};

type Lancamento = {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number | string;
  data_lancamento: string;
  accounts?: { nome: string } | null;
  categories?: { nome: string; cor?: string | null } | null;
};

const getTodayLocal = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

const parseCurrencyInput = (value: string) => {
  if (!value) return NaN;
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const formatarData = (data: string) =>
  new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");

export default function LancamentosPage() {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  const [tipo, setTipo] = useState<TipoLancamento>("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [dataLancamento, setDataLancamento] = useState(getTodayLocal());
  const [contaId, setContaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriaEscolhidaManualmente, setCategoriaEscolhidaManualmente] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (categoriaEscolhidaManualmente) return;

    const sugerida = inferirCategoriaId(descricao, tipo, categorias);
    if (sugerida) {
      setCategoriaId(sugerida);
      return;
    }

    if (!descricao.trim()) {
      const fallback = categorias.find((c) => c.tipo === tipo)?.id ?? "";
      setCategoriaId(fallback);
    }
  }, [descricao, tipo, categorias, categoriaEscolhidaManualmente]);

  const categoriasFiltradas = useMemo(() => {
    return categorias.filter((c) => c.tipo === tipo);
  }, [categorias, tipo]);

  const resumo = useMemo(() => {
    const hoje = new Date();
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    let receitasMes = 0;
    let despesasMes = 0;

    lancamentos.forEach((item) => {
      if (
        item.data_lancamento >= primeiroDiaMes &&
        item.data_lancamento <= ultimoDiaMes
      ) {
        const valorNumero = Number(item.valor ?? 0);
        if (item.tipo === "receita") receitasMes += valorNumero;
        if (item.tipo === "despesa") despesasMes += valorNumero;
      }
    });

    return {
      totalLancamentos: lancamentos.length,
      receitasMes,
      despesasMes,
      resultadoMes: receitasMes - despesasMes,
    };
  }, [lancamentos]);

  const prepararFormulario = (
    proxContas: Conta[] = contas,
    proxCategorias: Categoria[] = categorias,
    proxTipo: TipoLancamento = "despesa"
  ) => {
    setTipo(proxTipo);
    setDescricao("");
    setValor("");
    setDataLancamento(getTodayLocal());
    setFormError(null);
    setCategoriaEscolhidaManualmente(false);

    const primeiraConta = proxContas[0]?.id ?? "";
    const primeiraCategoria = proxCategorias.find((c) => c.tipo === proxTipo)?.id ?? "";

    setContaId(primeiraConta);
    setCategoriaId(primeiraCategoria);
  };

  const abrirModalNovo = () => {
    prepararFormulario();
    setIsModalOpen(true);
  };

  const recalcularSaldoConta = async (accountId: string, userId: string) => {
    const [{ data: conta, error: contaError }, { data: transacoes, error: transError }] =
      await Promise.all([
        supabase
          .from("accounts")
          .select("id, saldo_inicial")
          .eq("id", accountId)
          .eq("user_id", userId)
          .single(),
        supabase
          .from("transactions")
          .select("tipo, valor")
          .eq("user_id", userId)
          .eq("account_id", accountId),
      ]);

    if (contaError) throw new Error(`Erro ao buscar conta: ${contaError.message}`);
    if (transError) throw new Error(`Erro ao buscar transações da conta: ${transError.message}`);

    const saldoInicial = Number(conta?.saldo_inicial ?? 0);

    const saldoCalculado =
      saldoInicial +
      (transacoes ?? []).reduce((acc, transacao) => {
        const valor = Number(transacao.valor ?? 0);
        return transacao.tipo === "receita" ? acc + valor : acc - valor;
      }, 0);

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ saldo_atual: saldoCalculado })
      .eq("id", accountId)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error(`Erro ao atualizar saldo da conta: ${updateError.message}`);
    }
  };

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

      const [contasRes, categoriasRes, lancamentosRes] = await Promise.all([
        supabase.from("accounts").select("*").eq("user_id", user.id).order("nome", { ascending: true }),
        supabase.from("categories").select("*").eq("user_id", user.id).order("nome", { ascending: true }),
        supabase
          .from("transactions")
          .select("*, accounts:account_id(nome), categories:category_id(nome, cor)")
          .eq("user_id", user.id)
          .order("data_lancamento", { ascending: false }),
      ]);

      if (contasRes.error) throw new Error(contasRes.error.message);
      if (categoriasRes.error) throw new Error(categoriasRes.error.message);
      if (lancamentosRes.error) throw new Error(lancamentosRes.error.message);

      const contasData = (contasRes.data ?? []) as Conta[];
      const categoriasData = (categoriasRes.data ?? []) as Categoria[];
      const lancamentosData = (lancamentosRes.data ?? []) as Lancamento[];

      setContas(contasData);
      setCategorias(categoriasData);
      setLancamentos(lancamentosData);

      if (!contaId && contasData.length > 0) setContaId(contasData[0].id);
      if (!categoriaId && categoriasData.length > 0) {
        const categoriaDefault = categoriasData.find((c) => c.tipo === tipo);
        if (categoriaDefault) setCategoriaId(categoriaDefault.id);
      }
    } catch (err: any) {
      alert("🛑 Erro ao carregar dados: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrocarTipo = (novoTipo: TipoLancamento) => {
    setTipo(novoTipo);
    setFormError(null);
    setCategoriaEscolhidaManualmente(false);

    const primeiraCategoriaDoTipo = categorias.find((c) => c.tipo === novoTipo)?.id ?? "";
    setCategoriaId(primeiraCategoriaDoTipo);
  };

  const handleSalvar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSaving) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFormError("Sistema perdeu o login. Entre novamente.");
      return;
    }
    if (!contaId) return setFormError("Selecione a conta.");
    if (!categoriaId) return setFormError("Selecione a categoria.");

    const valorNumerico = parseCurrencyInput(valor);

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return setFormError("Digite um valor válido maior que zero.");
    }

    const categoriaSelecionada = categorias.find((c) => c.id === categoriaId);
    if (!categoriaSelecionada) return setFormError("Categoria inválida.");
    if (categoriaSelecionada.tipo !== tipo) {
      return setFormError("A categoria selecionada não pertence ao tipo escolhido.");
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const { error: insertError } = await supabase.from("transactions").insert([
        {
          user_id: user.id,
          account_id: contaId,
          category_id: categoriaId,
          tipo,
          descricao: descricao.trim(),
          valor: valorNumerico,
          data_lancamento: dataLancamento,
          data_competencia: dataLancamento,
          status: "pago",
        },
      ]);

      if (insertError) throw new Error(insertError.message);

      await recalcularSaldoConta(contaId, user.id);
      await carregarDados();

      const categoriaDefaultMesmoTipo = categorias.find((c) => c.tipo === tipo)?.id ?? "";
      setDescricao("");
      setValor("");
      setDataLancamento(getTodayLocal());
      setCategoriaId(categoriaDefaultMesmoTipo);
      setCategoriaEscolhidaManualmente(false);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Erro ao salvar lançamento.");
    } finally {
      setIsSaving(false);
    }
  };

  const podeSalvar = !!contaId && !!categoriaId && !isSaving;

  return (
    <div className="min-h-screen text-gray-100 flex font-sans no-tap-highlight">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-8 mobile-safe">
        <header className="mb-6">
          <div className="glass-card rounded-[28px] p-5 md:p-7 border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_25%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_22%)]" />
            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.18em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  lançamentos + classificação
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Entradas e saídas,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                    com sugestão automática.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl leading-relaxed">
                  Ao digitar a descrição, o app já tenta encaixar a categoria sozinho.
                </p>
              </div>

              <button
                onClick={abrirModalNovo}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3.5 font-bold shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-5 h-5" />
                Novo lançamento
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <Resumo label="Total lançado" valor={String(resumo.totalLancamentos)} icon={<Receipt className="w-5 h-5 text-blue-400" />} />
          <Resumo label="Receitas do mês" valor={formatarMoeda(resumo.receitasMes)} icon={<ArrowUpCircle className="w-5 h-5 text-emerald-400" />} />
          <Resumo label="Despesas do mês" valor={formatarMoeda(resumo.despesasMes)} icon={<ArrowDownCircle className="w-5 h-5 text-red-400" />} />
          <Resumo
            label="Resultado do mês"
            valor={formatarMoeda(resumo.resultadoMes)}
            icon={<Landmark className={`w-5 h-5 ${resumo.resultadoMes >= 0 ? "text-emerald-400" : "text-red-400"}`} />}
          />
        </section>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : lancamentos.length === 0 ? (
          <div className="glass-card rounded-[28px] p-10 text-center border border-white/5">
            <Receipt className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Nenhum lançamento ainda</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Crie seu primeiro lançamento para começar a montar seu histórico.
            </p>
          </div>
        ) : (
          <>
            <section className="md:hidden space-y-3">
              {lancamentos.map((lanc) => (
                <div key={lanc.id} className="glass-card rounded-[24px] p-4 border border-white/5">
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
                        style={{ backgroundColor: lanc.categories?.cor || "#64748b" }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{lanc.descricao}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {lanc.accounts?.nome || "Conta apagada"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`text-sm font-bold ${lanc.tipo === "receita" ? "text-emerald-400" : "text-red-400"}`}>
                            {lanc.tipo === "receita" ? "+" : "-"} {formatarMoeda(Number(lanc.valor))}
                          </p>
                          <p className="text-[11px] text-gray-600 mt-1">{formatarData(lanc.data_lancamento)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                          style={{
                            backgroundColor: `${lanc.categories?.cor || "#64748b"}15`,
                            color: lanc.categories?.cor || "#94a3b8",
                            border: `1px solid ${lanc.categories?.cor || "#64748b"}20`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lanc.categories?.cor || "#64748b" }} />
                          {lanc.categories?.nome || "Sem categoria"}
                        </span>

                        <ChevronRight className="w-4 h-4 text-gray-700" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section className="hidden md:block">
              <div className="glass-card rounded-[28px] overflow-hidden border border-white/5">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-sm text-gray-300 whitespace-nowrap">
                    <thead className="bg-black/20 text-gray-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-5 font-semibold">Data</th>
                        <th className="px-6 py-5 font-semibold">Descrição</th>
                        <th className="px-6 py-5 font-semibold">Categoria</th>
                        <th className="px-6 py-5 font-semibold">Conta</th>
                        <th className="px-6 py-5 font-semibold text-right">Valor</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/[0.05]">
                      {lancamentos.map((lanc) => (
                        <tr key={lanc.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="px-6 py-4 text-gray-400">{formatarData(lanc.data_lancamento)}</td>
                          <td className="px-6 py-4 font-medium text-gray-100">{lanc.descricao}</td>
                          <td className="px-6 py-4">
                            <span
                              className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 w-max"
                              style={{
                                backgroundColor: `${lanc.categories?.cor || "#6b7280"}15`,
                                color: lanc.categories?.cor || "#9ca3af",
                              }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lanc.categories?.cor || "#6b7280" }} />
                              {lanc.categories?.nome || "Sem categoria"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-gray-600" />
                              {lanc.accounts?.nome || "Conta apagada"}
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${lanc.tipo === "receita" ? "text-emerald-400" : "text-red-400"}`}>
                            {lanc.tipo === "receita" ? "+" : "-"} {formatarMoeda(Number(lanc.valor))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="w-full md:max-w-md glass-card-strong rounded-t-[30px] md:rounded-[30px] border border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="sticky top-0 z-10 bg-[#0d1420]/90 backdrop-blur-xl border-b border-white/5">
                <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-3 md:hidden" />
                <div className="flex justify-between items-center p-5 md:p-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Novo lançamento</h2>
                    <p className="text-xs text-gray-500 mt-1">Com classificação automática</p>
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
                {!contas.length || !categorias.length ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Você precisa cadastrar pelo menos uma conta e uma categoria.
                  </div>
                ) : (
                  <form id="novo-lancamento-form" onSubmit={handleSalvar} className="space-y-6">
                    <div className="flex p-1 bg-black/20 rounded-2xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => handleTrocarTipo("despesa")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                          tipo === "despesa" ? "bg-red-500/10 text-red-400" : "text-gray-500"
                        }`}
                      >
                        <ArrowDownCircle className="w-4 h-4" />
                        Despesa
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTrocarTipo("receita")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                          tipo === "receita" ? "bg-emerald-500/10 text-emerald-400" : "text-gray-500"
                        }`}
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Receita
                      </button>
                    </div>

                    <div className="rounded-[24px] bg-black/20 border border-white/5 p-5 text-center">
                      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3">
                        Valor
                      </label>
                      <div className="flex items-center justify-center text-4xl md:text-5xl font-black text-white">
                        <span className="text-xl md:text-2xl text-gray-500 mr-2">R$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          required
                          value={valor}
                          onChange={(e) => setValor(e.target.value)}
                          placeholder="0,00"
                          className="bg-transparent border-none outline-none text-center w-44 md:w-52 placeholder-gray-800 focus:ring-0 p-0"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Tag className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          required
                          value={descricao}
                          onChange={(e) => setDescricao(e.target.value)}
                          placeholder={tipo === "despesa" ? "Ex: Uber, iFood, farmácia..." : "Ex: salário, dividendo..."}
                          className="w-full pl-12 bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Wallet className="h-4 w-4 text-gray-500" />
                          </div>
                          <select
                            value={contaId}
                            onChange={(e) => setContaId(e.target.value)}
                            className="w-full pl-10 bg-black/20 border border-white/5 text-white rounded-2xl p-4 text-sm outline-none"
                          >
                            <option value="">Conta...</option>
                            {contas.map((c) => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </select>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar className="h-4 w-4 text-gray-500" />
                          </div>
                          <input
                            type="date"
                            value={dataLancamento}
                            onChange={(e) => setDataLancamento(e.target.value)}
                            className="w-full pl-10 bg-black/20 border border-white/5 text-white rounded-2xl p-4 text-sm outline-none [color-scheme:dark]"
                          />
                        </div>
                      </div>

                      <select
                        value={categoriaId}
                        onChange={(e) => {
                          setCategoriaId(e.target.value);
                          setCategoriaEscolhidaManualmente(true);
                        }}
                        className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none"
                      >
                        <option value="">Selecione a categoria...</option>
                        {categoriasFiltradas.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>

                      {formError && (
                        <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                          <span>{formError}</span>
                        </div>
                      )}
                    </div>
                  </form>
                )}
              </div>

              <div className="p-5 md:p-6 border-t border-white/5 bg-[#0d1420]/80 backdrop-blur-xl sticky bottom-0 z-10">
                <button
                  type="submit"
                  form="novo-lancamento-form"
                  disabled={!podeSalvar || !contas.length || !categorias.length}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 rounded-2xl text-base font-bold disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Confirmar lançamento"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Resumo({
  label,
  valor,
  icon,
}: {
  label: string;
  valor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-[24px] p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/5 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">{label}</p>
          <h2 className="text-2xl md:text-3xl font-black text-white mt-3">{valor}</h2>
        </div>
      </div>
    </div>
  );
}