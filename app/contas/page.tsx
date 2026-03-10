"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  X,
  Loader2,
  Wallet,
  Landmark,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  PiggyBank,
  ChevronRight,
} from "lucide-react";

type Usuario = {
  id: string;
};

type Conta = {
  id: string;
  nome: string;
  saldo_inicial: number | string | null;
  saldo_atual: number | string | null;
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const parseCurrencyInput = (value: string) => {
  if (!value) return 0;

  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export default function ContasPage() {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState<Usuario | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);

  const [nome, setNome] = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
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

      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("nome", { ascending: true });

      if (error) throw new Error(error.message);

      setContas((data ?? []) as Conta[]);
    } catch (err: any) {
      alert("🛑 Erro ao carregar contas: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalNovaConta = () => {
    setNome("");
    setSaldoInicial("");
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

    const valorSaldo = parseCurrencyInput(saldoInicial);

    if (!nome.trim()) {
      setFormError("Digite o nome da conta.");
      return;
    }

    if (Number.isNaN(valorSaldo)) {
      setFormError("Digite um saldo inicial válido.");
      return;
    }

    const contaDuplicada = contas.some(
      (conta) => conta.nome.trim().toLowerCase() === nome.trim().toLowerCase()
    );

    if (contaDuplicada) {
      setFormError("Já existe uma conta com esse nome.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const { error } = await supabase.from("accounts").insert([
        {
          user_id: user.id,
          nome: nome.trim(),
          saldo_inicial: valorSaldo,
          saldo_atual: valorSaldo,
        },
      ]);

      if (error) throw new Error(error.message);

      await carregarDados();
      setIsModalOpen(false);
      setNome("");
      setSaldoInicial("");
    } catch (err: any) {
      setFormError(err.message || "Erro ao salvar conta.");
    } finally {
      setIsSaving(false);
    }
  };

  const resumo = useMemo(() => {
    const saldoTotal = contas.reduce(
      (acc, conta) => acc + Number(conta.saldo_atual ?? 0),
      0
    );

    const contasPositivas = contas.filter(
      (conta) => Number(conta.saldo_atual ?? 0) >= 0
    ).length;

    const contasNegativas = contas.filter(
      (conta) => Number(conta.saldo_atual ?? 0) < 0
    ).length;

    const maiorSaldo = contas.reduce((maior, conta) => {
      const saldo = Number(conta.saldo_atual ?? 0);
      return saldo > maior ? saldo : maior;
    }, 0);

    return {
      saldoTotal,
      contasPositivas,
      contasNegativas,
      totalContas: contas.length,
      maiorSaldo,
    };
  }, [contas]);

  return (
    <div className="min-h-screen text-gray-100 flex font-sans no-tap-highlight">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-8 mobile-safe">
        <header className="mb-6 md:mb-8">
          <div className="glass-card rounded-[28px] p-5 md:p-7 border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.13),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_22%)]" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.18em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  contas e carteiras
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Seu saldo,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                    organizado de verdade.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl leading-relaxed">
                  Veja suas contas, acompanhe variações e mantenha sua base
                  financeira limpa e fácil de ler no celular e no desktop.
                </p>
              </div>

              <button
                onClick={abrirModalNovaConta}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3.5 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                <Plus className="w-5 h-5" />
                Nova conta
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Patrimônio líquido
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {formatarMoeda(resumo.saldoTotal)}
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
                  Total de contas
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {resumo.totalContas}
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
                  Contas positivas
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-emerald-400 mt-3">
                  {resumo.contasPositivas}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Contas negativas
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-red-400 mt-3">
                  {resumo.contasNegativas}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : contas.length === 0 ? (
          <div className="glass-card rounded-[28px] p-10 text-center border border-white/5">
            <PiggyBank className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Nenhuma conta cadastrada
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Crie sua primeira conta para começar a controlar seus saldos e
              acompanhar seu dinheiro direito.
            </p>

            <button
              onClick={abrirModalNovaConta}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              <Plus className="w-5 h-5" />
              Nova conta
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {contas.map((conta) => {
              const saldo = Number(conta.saldo_atual ?? 0);
              const saldoInicialNumero = Number(conta.saldo_inicial ?? 0);
              const variacao = saldo - saldoInicialNumero;
              const positiva = saldo >= 0;

              return (
                <div
                  key={conta.id}
                  className="glass-card rounded-[26px] p-5 md:p-6 border border-white/5 card-hover"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/5 flex items-center justify-center shrink-0">
                      <Landmark
                        className={`w-5 h-5 ${
                          positiva ? "text-emerald-400" : "text-red-400"
                        }`}
                      />
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        positiva
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                          : "bg-red-500/10 text-red-400 border-red-500/15"
                      }`}
                    >
                      {positiva ? "Saudável" : "Atenção"}
                    </span>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-lg font-bold text-white truncate">
                      {conta.nome}
                    </h3>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold mt-2">
                      Saldo atual
                    </p>

                    <p
                      className={`text-3xl font-black mt-3 leading-none ${
                        positiva ? "text-white" : "text-red-400"
                      }`}
                    >
                      {formatarMoeda(saldo)}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                        Inicial
                      </p>
                      <p className="text-sm font-semibold text-gray-200 mt-2 truncate">
                        {formatarMoeda(saldoInicialNumero)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-black/20 border border-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                        Variação
                      </p>
                      <p
                        className={`text-sm font-semibold mt-2 truncate ${
                          variacao >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {variacao >= 0 ? "+" : "-"}{" "}
                        {formatarMoeda(Math.abs(variacao))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-xs text-gray-500">
                    <span>Conta financeira</span>
                    <ChevronRight className="w-4 h-4 text-gray-700" />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
            <div className="w-full md:max-w-md glass-card-strong rounded-t-[30px] md:rounded-[30px] border border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="sticky top-0 z-10 bg-[#0d1420]/90 backdrop-blur-xl border-b border-white/5">
                <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-3 md:hidden" />

                <div className="flex justify-between items-center p-5 md:p-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Nova conta</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Cadastre um banco, carteira ou saldo inicial
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
                <form id="nova-conta-form" onSubmit={handleSalvar} className="space-y-6">
                  <div className="rounded-[24px] bg-black/20 border border-white/5 p-5 text-center">
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3">
                      Saldo inicial
                    </label>

                    <div className="flex items-center justify-center text-4xl md:text-5xl font-black text-white">
                      <span className="text-xl md:text-2xl text-gray-500 mr-2">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={saldoInicial}
                        onChange={(e) => setSaldoInicial(e.target.value)}
                        placeholder="0,00"
                        className="bg-transparent border-none outline-none text-center w-44 md:w-52 placeholder-gray-800 focus:ring-0 p-0"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Landmark className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome da conta (Ex: Nubank, Itaú, Carteira...)"
                      className="w-full pl-12 bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                      autoFocus
                    />
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
                  form="nova-conta-form"
                  disabled={isSaving}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-105 text-gray-950 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Criar conta"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}