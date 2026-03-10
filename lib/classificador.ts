// lib/classificador.ts

type TipoLancamento = "receita" | "despesa";

type Categoria = {
  id: string;
  nome: string;
  tipo: TipoLancamento;
};

const regras: Array<{
  tipo: TipoLancamento;
  palavras: string[];
  categoriasProvaveis: string[];
}> = [
  {
    tipo: "despesa",
    palavras: ["uber", "99", "combustivel", "posto", "gasolina", "etanol", "diesel"],
    categoriasProvaveis: ["transporte", "combustível", "veículo"],
  },
  {
    tipo: "despesa",
    palavras: ["ifood", "restaurante", "lanche", "pizza", "hamburguer", "padaria", "mercado", "supermercado"],
    categoriasProvaveis: ["alimentação", "mercado", "supermercado"],
  },
  {
    tipo: "despesa",
    palavras: ["farmacia", "droga", "medico", "clinica", "exame", "hospital"],
    categoriasProvaveis: ["saúde", "farmácia", "médico"],
  },
  {
    tipo: "despesa",
    palavras: ["netflix", "spotify", "prime", "youtube", "apple", "google one"],
    categoriasProvaveis: ["assinaturas", "lazer", "streaming"],
  },
  {
    tipo: "despesa",
    palavras: ["energia", "luz", "agua", "saneago", "internet", "telefone", "vivo", "tim", "claro"],
    categoriasProvaveis: ["moradia", "contas da casa", "utilidades"],
  },
  {
    tipo: "receita",
    palavras: ["salario", "salário", "pro labore", "pró-labore", "bonus", "bônus", "comissao", "comissão"],
    categoriasProvaveis: ["salário", "pro labore", "receita"],
  },
  {
    tipo: "receita",
    palavras: ["rendimento", "juros", "dividendo", "dividendos"],
    categoriasProvaveis: ["rendimentos", "investimentos", "receita financeira"],
  },
];

const normalizar = (txt: string) =>
  txt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function inferirCategoriaId(
  descricao: string,
  tipo: TipoLancamento,
  categorias: Categoria[]
) {
  const texto = normalizar(descricao);
  if (!texto) return null;

  const categoriasDoTipo = categorias.filter((c) => c.tipo === tipo);

  for (const regra of regras) {
    if (regra.tipo !== tipo) continue;

    const bateu = regra.palavras.some((p) => texto.includes(normalizar(p)));
    if (!bateu) continue;

    for (const nomeProvavel of regra.categoriasProvaveis) {
      const match = categoriasDoTipo.find((c) =>
        normalizar(c.nome).includes(normalizar(nomeProvavel))
      );
      if (match) return match.id;
    }
  }

  const matchDireto = categoriasDoTipo.find((c) =>
    texto.includes(normalizar(c.nome))
  );

  return matchDireto?.id ?? null;
}