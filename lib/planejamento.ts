// lib/planejamento.ts

export type TipoPlanejamento = "receita" | "despesa";
export type RegraPlanejamento = "unico" | "recorrente" | "parcelado";

export type PlanejamentoItem = {
  id: string;
  nome: string;
  tipo: TipoPlanejamento;
  regra_tipo: RegraPlanejamento;
  valor: number | string;
  data_inicio: string;
  data_fim?: string | null;
  total_parcelas?: number | null;
  ativo?: boolean | null;
};

export type ContaInvestimentoProj = {
  id: string;
  nome: string;
  saldo_atual: number | string;
  aporte_mensal?: number | string | null;
  rentabilidade_mensal?: number | string | null;
  ativo?: boolean | null;
};

export type LinhaProjecao = {
  chave: string;
  rotulo: string;
  saldo_inicial: number;
  entradas: number;
  saidas_operacionais: number;
  aporte_investimentos: number;
  saidas_totais: number;
  saldo_final: number;
  rendimento_investimentos: number;
  saldo_investimentos: number;
  patrimonio_total: number;
};

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

const firstDayOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const monthDistance = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

const sameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

const isValidNumber = (value: unknown) => Number.isFinite(Number(value ?? 0));

const shouldApplyEntryInMonth = (
  item: PlanejamentoItem,
  targetMonth: Date
): boolean => {
  if (item.ativo === false) return false;

  const inicio = firstDayOfMonth(new Date(`${item.data_inicio}T00:00:00`));
  const alvo = firstDayOfMonth(targetMonth);

  if (alvo < inicio) return false;

  if (item.regra_tipo === "unico") {
    return sameMonth(inicio, alvo);
  }

  if (item.regra_tipo === "recorrente") {
    if (!item.data_fim) return true;
    const fim = firstDayOfMonth(new Date(`${item.data_fim}T00:00:00`));
    return alvo <= fim;
  }

  if (item.regra_tipo === "parcelado") {
    const totalParcelas = Number(item.total_parcelas ?? 0);
    if (!totalParcelas || totalParcelas <= 0) return false;

    const diff = monthDistance(inicio, alvo);
    return diff >= 0 && diff < totalParcelas;
  }

  return false;
};

export function projetarInvestimentoUnico(
  saldoAtual: number,
  aporteMensal: number,
  rentabilidadeMensalPercentual: number,
  meses = 60
) {
  let saldo = saldoAtual;

  for (let i = 0; i < meses; i++) {
    const rendimento = saldo * (rentabilidadeMensalPercentual / 100);
    saldo += rendimento + aporteMensal;
  }

  return saldo;
}

export function gerarProjecaoMensal(params: {
  saldoInicialCaixa: number;
  planejamento: PlanejamentoItem[];
  investimentos: ContaInvestimentoProj[];
  meses?: number;
  iniciarNoMesSeguinte?: boolean;
}) {
  const {
    saldoInicialCaixa,
    planejamento,
    investimentos,
    meses = 60,
    iniciarNoMesSeguinte = true,
  } = params;

  const hoje = new Date();
  const inicioBase = iniciarNoMesSeguinte
    ? new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
    : new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const linhas: LinhaProjecao[] = [];
  let saldoCaixa = saldoInicialCaixa;

  const saldosInvestimentos = investimentos
    .filter((inv) => inv.ativo !== false)
    .map((inv) => ({
      ...inv,
      saldo: Number(inv.saldo_atual ?? 0),
      aporte: Number(inv.aporte_mensal ?? 0),
      taxa: Number(inv.rentabilidade_mensal ?? 0),
    }));

  for (let i = 0; i < meses; i++) {
    const mes = new Date(inicioBase.getFullYear(), inicioBase.getMonth() + i, 1);

    let entradas = 0;
    let saidasOperacionais = 0;

    planejamento.forEach((item) => {
      if (!shouldApplyEntryInMonth(item, mes)) return;

      const valor = Number(item.valor ?? 0);
      if (!isValidNumber(valor)) return;

      if (item.tipo === "receita") entradas += valor;
      if (item.tipo === "despesa") saidasOperacionais += valor;
    });

    let aporteInvestimentos = 0;
    let rendimentoInvestimentos = 0;
    let saldoInvestimentos = 0;

    saldosInvestimentos.forEach((inv) => {
      const rendimento = inv.saldo * (inv.taxa / 100);
      rendimentoInvestimentos += rendimento;

      inv.saldo = inv.saldo + rendimento + inv.aporte;
      aporteInvestimentos += inv.aporte;
      saldoInvestimentos += inv.saldo;
    });

    const saldoInicialMes = saldoCaixa;
    const saidasTotais = saidasOperacionais + aporteInvestimentos;
    const saldoFinalMes = saldoInicialMes + entradas - saidasTotais;

    linhas.push({
      chave: formatMonthKey(mes),
      rotulo: formatMonthLabel(mes),
      saldo_inicial: saldoInicialMes,
      entradas,
      saidas_operacionais: saidasOperacionais,
      aporte_investimentos: aporteInvestimentos,
      saidas_totais: saidasTotais,
      saldo_final: saldoFinalMes,
      rendimento_investimentos: rendimentoInvestimentos,
      saldo_investimentos: saldoInvestimentos,
      patrimonio_total: saldoFinalMes + saldoInvestimentos,
    });

    saldoCaixa = saldoFinalMes;
  }

  return linhas;
}