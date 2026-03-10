"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  CreditCard,
  X,
  Loader2,
  Landmark,
  AlertCircle,
  CalendarDays,
  Sparkles,
  ChevronRight,
  WalletCards,
  BadgeDollarSign,
} from "lucide-react";

type Usuario = {
  id: string;
};

type Conta = {
  id: string;
  nome: string;
};

type Cartao = {
  id: string;
  nome: string;
  limite: number | string | null;
  fechamento_dia: number | null;
  vencimento_dia: number | null;
  ativo: boolean | null;
  accounts?: {
    nome: string;
  } | null;
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

export default function CartoesPage() {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState<Usuario | null>(null);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);

  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState("");
  const [fechamentoDia, setFechamentoDia] = useState("");
  const [vencimentoDia, setVencimentoDia] = useState("");
  const [contaId, setContaId] = useState("");

  const [isSaving, setIsSaving] = useState(false);
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

      setUser({ id: user.id });

      const [contasRes, cartoesRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, nome")
          .eq("user_id", user.id)
          .order("nome", { ascending: true }),

        supabase
          .from("credit_cards")
          .select(`
            *,
            accounts:account_id (nome)
          `)
          .eq("user_id", user.id)
          .order("nome", { ascending: true }),
      ]);

      if (contasRes.error) throw new Error(contasRes.error.message);
      if (cartoesRes.error) throw new Error(cartoesRes.error.message);

      const contasData = (contasRes.data ?? []) as Conta[];
      const cartoesData = (cartoesRes.data ?? []) as Cartao[];

      setContas(contasData);
      setCartoes(cartoesData);

      if (!contaId && contasData.length > 0) {
        setContaId(contasData[0].id);
      }
    } catch (err: any) {
      alert("🛑 Erro ao carregar cartões: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setNome("");
    setLimite("");
    setFechamentoDia("");
    setVencimentoDia("");
    setContaId(contas[0]?.id ?? "");
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

    if (!contaId) {
      setFormError("Selecione a conta de débito da fatura.");
      return;
    }

    const valorLimite = parseCurrencyInput(limite);
    const fechamento = Number(fechamentoDia);
    const vencimento = Number(vencimentoDia);

    if (!nome.trim()) {
      setFormError("Digite o nome do cartão.");
      return;
    }

    if (!Number.isFinite(valorLimite) || valorLimite <= 0) {
      setFormError("Digite um limite válido maior que zero.");
      return;
    }

    if (!Number.isInteger(fechamento) || fechamento < 1 || fechamento > 31) {
      setFormError("O dia de fechamento deve estar entre 1 e 31.");
      return;
    }

    if (!Number.isInteger(vencimento) || vencimento < 1 || vencimento > 31) {
      setFormError("O dia de vencimento deve estar entre 1 e 31.");
      return;
    }

    const duplicado = cartoes.some(
      (c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase()
    );

    if (duplicado) {
      setFormError("Já existe um cartão com esse nome.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const { error } = await supabase.from("credit_cards").insert([
        {
          user_id: user.id,
          account_id: contaId,
          nome: nome.trim(),
          limite: valorLimite,
          fechamento_dia: fechamento,
          vencimento_dia: vencimento,
          ativo: true,
        },
      ]);

      if (error) throw new Error(error.message);

      await carregarDados();
      setIsModalOpen(false);
      setNome("");
      setLimite("");
      setFechamentoDia("");
      setVencimentoDia("");
    } catch (err: any) {
      setFormError(err.message || "Erro ao salvar cartão.");
    } finally {
      setIsSaving(false);
    }
  };

  const resumo = useMemo(() => {
    const limiteTotal = cartoes.reduce(
      (acc, cartao) => acc + Number(cartao.limite ?? 0),
      0
    );

    const totalCartoes = cartoes.length;
    const limiteMedio = totalCartoes > 0 ? limiteTotal / totalCartoes : 0;
    const ativos = cartoes.filter((cartao) => cartao.ativo !== false).length;

    return {
      limiteTotal,
      totalCartoes,
      limiteMedio,
      ativos,
    };
  }, [cartoes]);

  return (
    <div className="min-h-screen text-gray-100 flex font-sans no-tap-highlight">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-8 mobile-safe">
        <header className="mb-6 md:mb-8">
          <div className="glass-card rounded-[28px] p-5 md:p-7 border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_22%)]" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold uppercase tracking-[0.18em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  cartões
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Seus cartões,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    mais claros.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl leading-relaxed">
                  Veja limites, datas de fechamento e vencimento com uma leitura boa
                  no celular e no desktop.
                </p>
              </div>

              <button
                onClick={abrirModalNovo}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3.5 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                <Plus className="w-5 h-5" />
                Novo cartão
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Limite total
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {formatarMoeda(resumo.limiteTotal)}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <BadgeDollarSign className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Total de cartões
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {resumo.totalCartoes}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/5 flex items-center justify-center">
                <WalletCards className="w-5 h-5 text-gray-300" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Limite médio
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {formatarMoeda(resumo.limiteMedio)}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Landmark className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Ativos
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-emerald-400 mt-3">
                  {resumo.ativos}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : cartoes.length === 0 ? (
          <div className="glass-card rounded-[28px] p-10 text-center border border-white/5">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Nenhum cartão cadastrado
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Adicione seu primeiro cartão para acompanhar limites e datas de
              fatura sem bagunça.
            </p>

            <button
              onClick={abrirModalNovo}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              <Plus className="w-5 h-5" />
              Novo cartão
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {cartoes.map((cartao) => (
              <div
                key={cartao.id}
                className="relative overflow-hidden glass-card rounded-[28px] p-5 md:p-6 border border-white/5 card-hover"
              >
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-36 h-36 rounded-full bg-white/[0.04] blur-3xl" />

                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/5 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-blue-400" />
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        cartao.ativo === false
                          ? "bg-red-500/10 text-red-400 border-red-500/15"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                      }`}
                    >
                      {cartao.ativo === false ? "Inativo" : "Ativo"}
                    </span>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-xl font-black text-white tracking-tight truncate">
                      {cartao.nome}
                    </h3>

                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-2 truncate">
                      <Landmark className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                      Débito em: {cartao.accounts?.nome || "Conta apagada"}
                    </p>
                  </div>

                  <div className="mt-5 rounded-[22px] bg-black/20 border border-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                      Limite
                    </p>
                    <p className="text-3xl font-black text-white mt-3 leading-none">
                      {formatarMoeda(Number(cartao.limite ?? 0))}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                        Fecha
                      </p>
                      <p className="text-sm font-semibold text-gray-200 mt-2 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-yellow-500" />
                        Dia {cartao.fechamento_dia}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                        Vence
                      </p>
                      <p className="text-sm font-semibold text-red-400 mt-2">
                        Dia {cartao.vencimento_dia}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs text-gray-500">
                    <span>Cartão de crédito</span>
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </div>
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
                    <h2 className="text-xl font-bold text-white">Novo cartão</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Cadastre limite, conta e datas da fatura
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

              {contas.length === 0 ? (
                <div className="p-6">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
                    Você precisa cadastrar pelo menos <strong>uma conta</strong> antes de
                    criar um cartão.
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar">
                    <form id="novo-cartao-form" onSubmit={handleSalvar} className="space-y-6">
                      <div className="rounded-[24px] bg-black/20 border border-white/5 p-5 text-center">
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3">
                          Limite total
                        </label>

                        <div className="flex items-center justify-center text-4xl md:text-5xl font-black text-white">
                          <span className="text-xl md:text-2xl text-gray-500 mr-2">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            required
                            value={limite}
                            onChange={(e) => setLimite(e.target.value)}
                            placeholder="0,00"
                            className="bg-transparent border-none outline-none text-center w-44 md:w-52 placeholder-gray-800 focus:ring-0 p-0"
                            autoFocus
                          />
                        </div>
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <CreditCard className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          required
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Nome do cartão (Ex: Nubank, Black...)"
                          className="w-full pl-12 bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Landmark className="h-5 w-5 text-gray-500" />
                        </div>
                        <select
                          required
                          value={contaId}
                          onChange={(e) => setContaId(e.target.value)}
                          className="w-full pl-12 bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 appearance-none"
                        >
                          <option value="" disabled>
                            Conta para débito da fatura...
                          </option>
                          {contas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-black/20 border border-white/5 p-4">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3 block">
                            Fechamento
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            required
                            value={fechamentoDia}
                            onChange={(e) => setFechamentoDia(e.target.value)}
                            placeholder="25"
                            className="w-full bg-transparent border-none outline-none text-white font-bold text-lg p-0 focus:ring-0"
                          />
                        </div>

                        <div className="rounded-2xl bg-black/20 border border-white/5 p-4">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3 block">
                            Vencimento
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            required
                            value={vencimentoDia}
                            onChange={(e) => setVencimentoDia(e.target.value)}
                            placeholder="05"
                            className="w-full bg-transparent border-none outline-none text-white font-bold text-lg p-0 focus:ring-0"
                          />
                        </div>
                      </div>

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
                      form="novo-cartao-form"
                      disabled={isSaving}
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-105 text-gray-950 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSaving ? "Salvando..." : "Salvar cartão"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}