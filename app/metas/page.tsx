"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Target,
  Plus,
  X,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Trophy,
  Wallet,
} from "lucide-react";

type Usuario = {
  id: string;
};

type MetaStatus = "em_andamento" | "concluida";

type Meta = {
  id: string;
  nome: string;
  valor_meta: number | string;
  valor_atual: number | string;
  prazo: string | null;
  status: MetaStatus;
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

const formatarData = (data: string) => {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
};

export default function MetasPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<Usuario | null>(null);
  const [metas, setMetas] = useState<Meta[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAporteModalOpen, setIsAporteModalOpen] = useState(false);

  const [isSavingNovaMeta, setIsSavingNovaMeta] = useState(false);
  const [isSavingAporte, setIsSavingAporte] = useState(false);

  const [nome, setNome] = useState("");
  const [valorMeta, setValorMeta] = useState("");
  const [valorAtual, setValorAtual] = useState("");
  const [prazo, setPrazo] = useState("");
  const [formErrorMeta, setFormErrorMeta] = useState<string | null>(null);

  const [metaSelecionada, setMetaSelecionada] = useState<Meta | null>(null);
  const [valorAporte, setValorAporte] = useState("");
  const [formErrorAporte, setFormErrorAporte] = useState<string | null>(null);

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
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("status", { ascending: false })
        .order("prazo", { ascending: true, nullsFirst: false });

      if (error) throw new Error(error.message);

      setMetas((data ?? []) as Meta[]);
    } catch (err: any) {
      alert("🛑 Erro ao carregar metas: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalNovaMeta = () => {
    setNome("");
    setValorMeta("");
    setValorAtual("");
    setPrazo("");
    setFormErrorMeta(null);
    setIsModalOpen(true);
  };

  const abrirModalAporte = (meta: Meta) => {
    setMetaSelecionada(meta);
    setValorAporte("");
    setFormErrorAporte(null);
    setIsAporteModalOpen(true);
  };

  const handleSalvarNovaMeta = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSavingNovaMeta) return;
    if (!user) {
      setFormErrorMeta("Sistema perdeu o login. Entre novamente.");
      return;
    }

    const nomeTratado = nome.trim();
    const vMeta = parseCurrencyInput(valorMeta);
    const vAtual = valorAtual.trim() ? parseCurrencyInput(valorAtual) : 0;

    if (!nomeTratado) {
      setFormErrorMeta("Digite o nome da meta.");
      return;
    }

    if (!Number.isFinite(vMeta) || vMeta <= 0) {
      setFormErrorMeta("Digite um valor alvo válido maior que zero.");
      return;
    }

    if (!Number.isFinite(vAtual) || vAtual < 0) {
      setFormErrorMeta("O valor atual precisa ser zero ou maior.");
      return;
    }

    const status: MetaStatus = vAtual >= vMeta ? "concluida" : "em_andamento";

    setIsSavingNovaMeta(true);
    setFormErrorMeta(null);

    try {
      const { error } = await supabase.from("goals").insert([
        {
          user_id: user.id,
          nome: nomeTratado,
          valor_meta: vMeta,
          valor_atual: vAtual,
          prazo: prazo || null,
          status,
        },
      ]);

      if (error) throw new Error(error.message);

      await carregarDados();
      setIsModalOpen(false);
      setNome("");
      setValorMeta("");
      setValorAtual("");
      setPrazo("");
    } catch (err: any) {
      setFormErrorMeta(err.message || "Erro ao criar meta.");
    } finally {
      setIsSavingNovaMeta(false);
    }
  };

  const handleSalvarAporte = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSavingAporte) return;
    if (!metaSelecionada) {
      setFormErrorAporte("Nenhuma meta selecionada.");
      return;
    }

    const aporte = parseCurrencyInput(valorAporte);

    if (!Number.isFinite(aporte) || aporte <= 0) {
      setFormErrorAporte("Digite um valor de aporte válido maior que zero.");
      return;
    }

    const valorAtualNumero = Number(metaSelecionada.valor_atual ?? 0);
    const valorMetaNumero = Number(metaSelecionada.valor_meta ?? 0);
    const novoValorAtual = valorAtualNumero + aporte;
    const novoStatus: MetaStatus =
      novoValorAtual >= valorMetaNumero ? "concluida" : "em_andamento";

    setIsSavingAporte(true);
    setFormErrorAporte(null);

    try {
      const { error } = await supabase
        .from("goals")
        .update({
          valor_atual: novoValorAtual,
          status: novoStatus,
        })
        .eq("id", metaSelecionada.id);

      if (error) throw new Error(error.message);

      await carregarDados();
      setValorAporte("");
      setMetaSelecionada(null);
      setIsAporteModalOpen(false);
    } catch (err: any) {
      setFormErrorAporte(err.message || "Erro ao registrar aporte.");
    } finally {
      setIsSavingAporte(false);
    }
  };

  const resumo = useMemo(() => {
    const totalMetas = metas.length;
    const concluidas = metas.filter((m) => m.status === "concluida").length;
    const valorTotalMeta = metas.reduce((acc, meta) => acc + Number(meta.valor_meta ?? 0), 0);
    const valorTotalAtual = metas.reduce((acc, meta) => acc + Number(meta.valor_atual ?? 0), 0);

    return {
      totalMetas,
      concluidas,
      valorTotalMeta,
      valorTotalAtual,
    };
  }, [metas]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex font-sans selection:bg-emerald-500/30">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <header className="mb-8 mt-2 md:mt-0 flex justify-between items-end">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
              Metas Financeiras
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Acompanhe os seus objetivos e sonhos
            </p>
          </div>

          <button
            onClick={abrirModalNovaMeta}
            className="hidden md:flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Nova Meta
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-900/20 to-gray-900/40 backdrop-blur-xl border border-blue-900/30 rounded-3xl p-6 shadow-2xl">
            <p className="text-blue-400 font-semibold mb-1 text-sm tracking-wide uppercase">
              Metas criadas
            </p>
            <h2 className="text-3xl font-bold text-white">{resumo.totalMetas}</h2>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/60 rounded-3xl p-6">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
              Concluídas
            </p>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-400" />
              <span className="text-2xl font-bold text-white">{resumo.concluidas}</span>
            </div>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/60 rounded-3xl p-6">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
              Já acumulado
            </p>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-lg font-bold text-white">
                {formatarMoeda(resumo.valorTotalAtual)}
              </span>
            </div>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/60 rounded-3xl p-6">
            <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
              Alvo total
            </p>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              <span className="text-lg font-bold text-white">
                {formatarMoeda(resumo.valorTotalMeta)}
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : metas.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/40 backdrop-blur-xl border border-gray-800/60 rounded-3xl">
            <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhuma meta definida
            </h3>
            <p className="text-gray-400">
              Crie a sua primeira meta para começar a poupar com direção.
            </p>

            <button
              onClick={abrirModalNovaMeta}
              className="mt-6 inline-flex md:hidden items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Nova Meta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {metas.map((meta) => {
              const valorMetaNumero = Number(meta.valor_meta ?? 0);
              const valorAtualNumero = Number(meta.valor_atual ?? 0);
              const percentualReal =
                valorMetaNumero > 0 ? (valorAtualNumero / valorMetaNumero) * 100 : 0;
              const percentualBarra = Math.min(percentualReal, 100);
              const isConcluida = meta.status === "concluida";
              const faltante = Math.max(valorMetaNumero - valorAtualNumero, 0);

              return (
                <div
                  key={meta.id}
                  className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/60 rounded-3xl p-6 hover:bg-gray-800/40 transition-colors relative overflow-hidden"
                >
                  {isConcluida && (
                    <div className="absolute inset-0 bg-emerald-900/10 pointer-events-none" />
                  )}

                  <div className="flex justify-between items-start gap-4 mb-5 relative z-10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-3 rounded-2xl ${
                          isConcluida
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {isConcluida ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <Target className="w-6 h-6" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-xl font-bold text-white truncate">{meta.nome}</h3>
                        {meta.prazo && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Calendar className="w-3 h-3" />
                            Prazo: {formatarData(meta.prazo)}
                          </p>
                        )}
                      </div>
                    </div>

                    {!isConcluida && (
                      <button
                        onClick={() => abrirModalAporte(meta)}
                        className="text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-400/10 hover:bg-blue-400/20 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1 shrink-0"
                      >
                        <TrendingUp className="w-3 h-3" />
                        Aportar
                      </button>
                    )}
                  </div>

                  <div className="relative z-10">
                    <div className="flex justify-between items-end mb-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                          Acumulado
                        </p>
                        <p
                          className={`text-2xl font-bold ${
                            isConcluida ? "text-emerald-400" : "text-white"
                          }`}
                        >
                          {formatarMoeda(valorAtualNumero)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Objetivo</p>
                        <p className="text-sm font-medium text-gray-300">
                          {formatarMoeda(valorMetaNumero)}
                        </p>
                      </div>
                    </div>

                    <div className="w-full bg-gray-950 rounded-full h-3 mb-2 overflow-hidden border border-gray-800">
                      <div
                        className={`h-3 rounded-full transition-all duration-700 ${
                          isConcluida ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${percentualBarra}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <p className="text-gray-500">
                        {percentualReal.toFixed(1)}% alcançado
                      </p>
                      <p className="text-gray-500">
                        Falta{" "}
                        <span className="text-gray-300 font-medium">
                          {formatarMoeda(faltante)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-0">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-8 md:zoom-in duration-300 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-gray-800/60 bg-gray-900/80">
                <h2 className="text-xl font-bold text-white">Criar Nova Meta</h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormErrorMeta(null);
                  }}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <form id="nova-meta-form" onSubmit={handleSalvarNovaMeta} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome do Objetivo
                    </label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Reserva de emergência, Viagem..."
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Valor Alvo
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        value={valorMeta}
                        onChange={(e) => setValorMeta(e.target.value)}
                        placeholder="10000,00"
                        className="w-full bg-gray-950 border border-gray-800 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Valor Atual
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valorAtual}
                        onChange={(e) => setValorAtual(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-gray-950 border border-gray-800 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Prazo
                    </label>
                    <input
                      type="date"
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors [color-scheme:dark]"
                    />
                  </div>

                  {formErrorMeta && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                      <span>{formErrorMeta}</span>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-gray-800/60 bg-gray-900/80">
                <button
                  type="submit"
                  form="nova-meta-form"
                  disabled={isSavingNovaMeta}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSavingNovaMeta ? "A guardar..." : "Salvar Meta"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isAporteModalOpen && metaSelecionada && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-0">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-sm shadow-2xl animate-in slide-in-from-bottom-8 md:zoom-in duration-300 overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-gray-800/60 bg-gray-900/80">
                <h2 className="text-xl font-bold text-white">Adicionar Fundos</h2>
                <button
                  onClick={() => {
                    setIsAporteModalOpen(false);
                    setFormErrorAporte(null);
                    setMetaSelecionada(null);
                  }}
                  className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-6 p-4 bg-gray-950/80 rounded-2xl border border-gray-800">
                  <p className="text-sm text-gray-400">Meta selecionada</p>
                  <p className="text-lg font-bold text-white">{metaSelecionada.nome}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Falta{" "}
                    {formatarMoeda(
                      Math.max(
                        Number(metaSelecionada.valor_meta ?? 0) -
                          Number(metaSelecionada.valor_atual ?? 0),
                        0
                      )
                    )}{" "}
                    para atingir o objetivo.
                  </p>
                </div>

                <form id="aporte-meta-form" onSubmit={handleSalvarAporte} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Valor do Aporte
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={valorAporte}
                      onChange={(e) => setValorAporte(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-2xl p-4 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {formErrorAporte && (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                      <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                      <span>{formErrorAporte}</span>
                    </div>
                  )}
                </form>
              </div>

              <div className="p-6 border-t border-gray-800/60 bg-gray-900/80">
                <button
                  type="submit"
                  form="aporte-meta-form"
                  disabled={isSavingAporte}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl text-base font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSavingAporte ? "A registar..." : "Confirmar Aporte"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}