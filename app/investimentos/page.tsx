"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  TrendingUp,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Wallet,
  Landmark,
  PiggyBank,
} from "lucide-react";
import { projetarInvestimentoUnico } from "../../lib/planejamento";

type InvestmentAccount = {
  id: string;
  nome: string;
  instituicao: string | null;
  saldo_atual: number | string;
  aporte_mensal: number | string | null;
  rentabilidade_mensal: number | string | null;
  ativo: boolean | null;
  observacoes?: string | null;
};

type InvestmentMovement = {
  id: string;
  tipo: "aporte" | "resgate" | "rendimento";
  valor: number | string;
  data_movimento: string;
  observacao?: string | null;
  investment_accounts?: { nome: string } | null;
};

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

const parseCurrencyInput = (value: string) => {
  if (!value) return NaN;
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
};

const getHoje = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
};

export default function InvestimentosPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isModalContaOpen, setIsModalContaOpen] = useState(false);
  const [isModalMovimentoOpen, setIsModalMovimentoOpen] = useState(false);

  const [contas, setContas] = useState<InvestmentAccount[]>([]);
  const [movimentos, setMovimentos] = useState<InvestmentMovement[]>([]);

  const [isSavingConta, setIsSavingConta] = useState(false);
  const [isSavingMovimento, setIsSavingMovimento] = useState(false);

  const [formErrorConta, setFormErrorConta] = useState<string | null>(null);
  const [formErrorMovimento, setFormErrorMovimento] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [saldoAtual, setSaldoAtual] = useState("");
  const [aporteMensal, setAporteMensal] = useState("");
  const [rentabilidadeMensal, setRentabilidadeMensal] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [investmentAccountId, setInvestmentAccountId] = useState("");
  const [tipoMovimento, setTipoMovimento] = useState<"aporte" | "resgate" | "rendimento">("aporte");
  const [valorMovimento, setValorMovimento] = useState("");
  const [dataMovimento, setDataMovimento] = useState(getHoje());
  const [observacaoMovimento, setObservacaoMovimento] = useState("");

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

      const [contasRes, movimentosRes] = await Promise.all([
        supabase
          .from("investment_accounts")
          .select("*")
          .eq("user_id", user.id)
          .order("nome", { ascending: true }),

        supabase
          .from("investment_movements")
          .select("*, investment_accounts:investment_account_id(nome)")
          .eq("user_id", user.id)
          .order("data_movimento", { ascending: false }),
      ]);

      if (contasRes.error) throw new Error(contasRes.error.message);
      if (movimentosRes.error) throw new Error(movimentosRes.error.message);

      const contasData = (contasRes.data ?? []) as InvestmentAccount[];
      const movimentosData = (movimentosRes.data ?? []) as InvestmentMovement[];

      setContas(contasData);
      setMovimentos(movimentosData);

      if (!investmentAccountId && contasData.length > 0) {
        setInvestmentAccountId(contasData[0].id);
      }
    } catch (err: any) {
      alert("🛑 Erro ao carregar investimentos: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resumo = useMemo(() => {
    const totalAtual = contas.reduce((acc, conta) => acc + Number(conta.saldo_atual ?? 0), 0);
    const aporteMensalTotal = contas.reduce((acc, conta) => acc + Number(conta.aporte_mensal ?? 0), 0);

    const totalProjetado60 = contas.reduce((acc, conta) => {
      return (
        acc +
        projetarInvestimentoUnico(
          Number(conta.saldo_atual ?? 0),
          Number(conta.aporte_mensal ?? 0),
          Number(conta.rentabilidade_mensal ?? 0),
          60
        )
      );
    }, 0);

    return {
      totalAtual,
      aporteMensalTotal,
      totalProjetado60,
      totalContas: contas.length,
    };
  }, [contas]);

  const abrirModalConta = () => {
    setNome("");
    setInstituicao("");
    setSaldoAtual("");
    setAporteMensal("");
    setRentabilidadeMensal("");
    setObservacoes("");
    setFormErrorConta(null);
    setIsModalContaOpen(true);
  };

  const abrirModalMovimento = () => {
    setInvestmentAccountId(contas[0]?.id ?? "");
    setTipoMovimento("aporte");
    setValorMovimento("");
    setDataMovimento(getHoje());
    setObservacaoMovimento("");
    setFormErrorMovimento(null);
    setIsModalMovimentoOpen(true);
  };

  const handleSalvarConta = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return setFormErrorConta("Sessão expirada.");
    if (!nome.trim()) return setFormErrorConta("Digite o nome da conta de investimento.");

    const saldo = parseCurrencyInput(saldoAtual || "0");
    const aporte = parseCurrencyInput(aporteMensal || "0");
    const taxa = parseCurrencyInput(rentabilidadeMensal || "0");

    if (!Number.isFinite(saldo) || saldo < 0) return setFormErrorConta("Saldo atual inválido.");
    if (!Number.isFinite(aporte) || aporte < 0) return setFormErrorConta("Aporte mensal inválido.");
    if (!Number.isFinite(taxa) || taxa < 0) return setFormErrorConta("Rentabilidade mensal inválida.");

    setIsSavingConta(true);
    setFormErrorConta(null);

    try {
      const { error } = await supabase.from("investment_accounts").insert([
        {
          user_id: user.id,
          nome: nome.trim(),
          instituicao: instituicao.trim() || null,
          saldo_atual: saldo,
          aporte_mensal: aporte,
          rentabilidade_mensal: taxa,
          ativo: true,
          observacoes: observacoes.trim() || null,
        },
      ]);

      if (error) throw new Error(error.message);

      setIsModalContaOpen(false);
      await carregarDados();
    } catch (err: any) {
      setFormErrorConta(err.message || "Erro ao salvar investimento.");
    } finally {
      setIsSavingConta(false);
    }
  };

  const handleSalvarMovimento = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return setFormErrorMovimento("Sessão expirada.");
    if (!investmentAccountId) return setFormErrorMovimento("Selecione a conta.");
    if (!dataMovimento) return setFormErrorMovimento("Informe a data.");

    const valor = parseCurrencyInput(valorMovimento);
    if (!Number.isFinite(valor) || valor <= 0) {
      return setFormErrorMovimento("Digite um valor válido maior que zero.");
    }

    const contaSelecionada = contas.find((c) => c.id === investmentAccountId);
    if (!contaSelecionada) return setFormErrorMovimento("Conta inválida.");

    const saldoAtualConta = Number(contaSelecionada.saldo_atual ?? 0);
    const novoSaldo =
      tipoMovimento === "resgate"
        ? saldoAtualConta - valor
        : saldoAtualConta + valor;

    if (novoSaldo < 0) {
      return setFormErrorMovimento("O resgate não pode deixar o saldo negativo.");
    }

    setIsSavingMovimento(true);
    setFormErrorMovimento(null);

    try {
      const { error: insertError } = await supabase.from("investment_movements").insert([
        {
          user_id: user.id,
          investment_account_id: investmentAccountId,
          tipo: tipoMovimento,
          valor,
          data_movimento: dataMovimento,
          observacao: observacaoMovimento.trim() || null,
        },
      ]);

      if (insertError) throw new Error(insertError.message);

      const { error: updateError } = await supabase
        .from("investment_accounts")
        .update({ saldo_atual: novoSaldo })
        .eq("id", investmentAccountId)
        .eq("user_id", user.id);

      if (updateError) throw new Error(updateError.message);

      setIsModalMovimentoOpen(false);
      await carregarDados();
    } catch (err: any) {
      setFormErrorMovimento(err.message || "Erro ao salvar movimento.");
    } finally {
      setIsSavingMovimento(false);
    }
  };

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
                  investimentos
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Seu patrimônio,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    também projetado.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-3xl leading-relaxed">
                  Cadastre suas contas de investimento, aportes mensais e rentabilidade esperada.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={abrirModalConta}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3 font-bold shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-5 h-5" />
                  Nova conta
                </button>

                <button
                  onClick={abrirModalMovimento}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/[0.04] border border-white/10 text-white px-5 py-3 font-bold"
                >
                  <Plus className="w-5 h-5" />
                  Movimento
                </button>
              </div>
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
              <ResumoCard label="Saldo atual" valor={formatarMoeda(resumo.totalAtual)} icon={<Wallet className="w-5 h-5 text-blue-400" />} />
              <ResumoCard label="Aporte mensal" valor={formatarMoeda(resumo.aporteMensalTotal)} icon={<PiggyBank className="w-5 h-5 text-emerald-400" />} />
              <ResumoCard label="Projeção 60 meses" valor={formatarMoeda(resumo.totalProjetado60)} icon={<TrendingUp className="w-5 h-5 text-emerald-400" />} />
              <ResumoCard label="Contas" valor={String(resumo.totalContas)} icon={<Landmark className="w-5 h-5 text-gray-300" />} />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {contas.map((conta) => {
                const saldo = Number(conta.saldo_atual ?? 0);
                const aporte = Number(conta.aporte_mensal ?? 0);
                const taxa = Number(conta.rentabilidade_mensal ?? 0);
                const futuro = projetarInvestimentoUnico(saldo, aporte, taxa, 60);

                return (
                  <div key={conta.id} className="glass-card rounded-[26px] p-5 border border-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-white font-black text-xl truncate">{conta.nome}</h3>
                        <p className="text-xs text-gray-500 mt-1">{conta.instituicao || "Sem instituição"}</p>
                      </div>

                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-emerald-500/10 text-emerald-400 border-emerald-500/15">
                        ativa
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MiniInfo label="Saldo atual" valor={formatarMoeda(saldo)} color="text-white" />
                      <MiniInfo label="Aporte mensal" valor={formatarMoeda(aporte)} color="text-emerald-400" />
                      <MiniInfo label="Rentab. mensal" valor={`${taxa.toFixed(2)}%`} color="text-blue-400" />
                      <MiniInfo label="Proj. 60 meses" valor={formatarMoeda(futuro)} color="text-white" />
                    </div>
                  </div>
                );
              })}
            </section>

            <section>
              <h3 className="text-xl font-black text-white mb-4">Movimentos recentes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {movimentos.map((mov) => (
                  <div key={mov.id} className="glass-card rounded-[24px] p-4 border border-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white font-semibold">{mov.investment_accounts?.nome || "Conta"}</p>
                        <p className="text-xs text-gray-500 mt-1">{mov.data_movimento}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        mov.tipo === "aporte"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
                          : mov.tipo === "resgate"
                          ? "bg-red-500/10 text-red-400 border-red-500/15"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/15"
                      }`}>
                        {mov.tipo}
                      </span>
                    </div>

                    <p className="text-lg font-black text-white mt-3">{formatarMoeda(Number(mov.valor ?? 0))}</p>
                    {mov.observacao && <p className="text-sm text-gray-500 mt-2">{mov.observacao}</p>}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {isModalContaOpen && (
          <ModalShell
            title="Nova conta de investimento"
            subtitle="Cadastre saldo, aporte e rentabilidade mensal"
            onClose={() => setIsModalContaOpen(false)}
          >
            <form id="nova-conta-invest-form" onSubmit={handleSalvarConta} className="space-y-4">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none" />
              <input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Instituição" className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input value={saldoAtual} onChange={(e) => setSaldoAtual(e.target.value)} placeholder="Saldo atual" className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none" />
                <input value={aporteMensal} onChange={(e) => setAporteMensal(e.target.value)} placeholder="Aporte mensal" className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none" />
                <input value={rentabilidadeMensal} onChange={(e) => setRentabilidadeMensal(e.target.value)} placeholder="Rentabilidade % a.m." className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none" />
              </div>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações" className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none min-h-[100px]" />
              {formErrorConta && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <span>{formErrorConta}</span>
                </div>
              )}
            </form>

            <div className="p-5 md:p-6 border-t border-white/5 bg-[#0d1420]/80">
              <button
                type="submit"
                form="nova-conta-invest-form"
                disabled={isSavingConta}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 rounded-2xl text-base font-bold disabled:opacity-50"
              >
                {isSavingConta ? "Salvando..." : "Salvar conta"}
              </button>
            </div>
          </ModalShell>
        )}

        {isModalMovimentoOpen && (
          <ModalShell
            title="Novo movimento"
            subtitle="Aporte, resgate ou rendimento"
            onClose={() => setIsModalMovimentoOpen(false)}
          >
            <form id="novo-movimento-invest-form" onSubmit={handleSalvarMovimento} className="space-y-4">
              <select value={investmentAccountId} onChange={(e) => setInvestmentAccountId(e.target.value)} className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none">
                <option value="">Selecione a conta</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>{conta.nome}</option>
                ))}
              </select>

              <div className="grid grid-cols-3 gap-2">
                {(["aporte", "resgate", "rendimento"] as const).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => setTipoMovimento(tipo)}
                    className={`py-3 rounded-2xl text-sm font-bold border ${
                      tipoMovimento === tipo
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-black/20 text-gray-400 border-white/5"
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>

              <input value={valorMovimento} onChange={(e) => setValorMovimento(e.target.value)} placeholder="Valor" className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none" />
              <input type="date" value={dataMovimento} onChange={(e) => setDataMovimento(e.target.value)} className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none [color-scheme:dark]" />
              <textarea value={observacaoMovimento} onChange={(e) => setObservacaoMovimento(e.target.value)} placeholder="Observação" className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none min-h-[100px]" />

              {formErrorMovimento && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <span>{formErrorMovimento}</span>
                </div>
              )}
            </form>

            <div className="p-5 md:p-6 border-t border-white/5 bg-[#0d1420]/80">
              <button
                type="submit"
                form="novo-movimento-invest-form"
                disabled={isSavingMovimento}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 rounded-2xl text-base font-bold disabled:opacity-50"
              >
                {isSavingMovimento ? "Salvando..." : "Salvar movimento"}
              </button>
            </div>
          </ModalShell>
        )}
      </main>
    </div>
  );
}

function ResumoCard({
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

function MiniInfo({
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

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-lg glass-card-strong rounded-t-[30px] md:rounded-[30px] border border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="sticky top-0 z-10 bg-[#0d1420]/90 backdrop-blur-xl border-b border-white/5">
          <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mt-3 md:hidden" />
          <div className="flex justify-between items-center p-5 md:p-6">
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/[0.04] hover:bg-white/[0.08] rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}