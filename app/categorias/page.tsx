"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";
import {
  Plus,
  X,
  Loader2,
  Tags,
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  AlertCircle,
  Palette,
  Sparkles,
  ChevronRight,
} from "lucide-react";

type TipoCategoria = "despesa" | "receita";
type FiltroCategoria = "todas" | TipoCategoria;

type Usuario = {
  id: string;
};

type Categoria = {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  cor: string | null;
};

const paletaCores = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#f43f5e",
  "#64748b",
];

export default function CategoriasPage() {
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState<Usuario | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroCategoria>("todas");

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCategoria>("despesa");
  const [cor, setCor] = useState("#64748b");
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
        .from("categories")
        .select("*")
        .eq("user_id", user.id)
        .order("nome", { ascending: true });

      if (error) throw new Error(error.message);

      setCategorias((data ?? []) as Categoria[]);
    } catch (err: any) {
      alert("🛑 Erro ao carregar categorias: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setNome("");
    setTipo("despesa");
    setCor("#64748b");
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

    const nomeTratado = nome.trim();

    if (!nomeTratado) {
      setFormError("Digite o nome da categoria.");
      return;
    }

    const categoriaDuplicada = categorias.some(
      (c) => c.nome.trim().toLowerCase() === nomeTratado.toLowerCase() && c.tipo === tipo
    );

    if (categoriaDuplicada) {
      setFormError(`Já existe uma categoria de ${tipo} com esse nome.`);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const { error } = await supabase.from("categories").insert([
        {
          user_id: user.id,
          nome: nomeTratado,
          tipo,
          cor,
        },
      ]);

      if (error) throw new Error(error.message);

      await carregarDados();
      setIsModalOpen(false);
      setNome("");
      setTipo("despesa");
      setCor("#64748b");
    } catch (err: any) {
      setFormError(err.message || "Erro ao salvar categoria.");
    } finally {
      setIsSaving(false);
    }
  };

  const categoriasFiltradas = useMemo(() => {
    return categorias.filter((c) => filtroAtivo === "todas" || c.tipo === filtroAtivo);
  }, [categorias, filtroAtivo]);

  const resumo = useMemo(() => {
    const totalCategorias = categorias.length;
    const totalDespesas = categorias.filter((c) => c.tipo === "despesa").length;
    const totalReceitas = categorias.filter((c) => c.tipo === "receita").length;

    return {
      totalCategorias,
      totalDespesas,
      totalReceitas,
    };
  }, [categorias]);

  const previewTitulo = nome.trim() || "Nova categoria";

  return (
    <div className="min-h-screen text-gray-100 flex font-sans no-tap-highlight">
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-64 w-full max-w-7xl mx-auto px-4 md:px-8 pt-4 md:pt-8 pb-28 md:pb-8 mobile-safe">
        <header className="mb-6 md:mb-8">
          <div className="glass-card rounded-[28px] p-5 md:p-7 border border-white/5 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_22%)]" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-bold uppercase tracking-[0.18em]">
                  <Sparkles className="w-3.5 h-3.5" />
                  categorias
                </div>

                <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight text-white">
                  Seu fluxo,
                  <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-emerald-400">
                    organizado por tipo.
                  </span>
                </h1>

                <p className="text-sm md:text-base text-gray-400 mt-3 max-w-2xl leading-relaxed">
                  Separe receitas e despesas com categorias bem visuais, fáceis de
                  identificar no celular e no desktop.
                </p>
              </div>

              <button
                onClick={abrirModalNovo}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3.5 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                <Plus className="w-5 h-5" />
                Nova categoria
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Total de categorias
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-white mt-3">
                  {resumo.totalCategorias}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Tags className="w-5 h-5 text-violet-400" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Despesas
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-red-400 mt-3">
                  {resumo.totalDespesas}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <ArrowDownCircle className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-[24px] p-5 card-hover sm:col-span-2 xl:col-span-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500 font-semibold">
                  Receitas
                </p>
                <h2 className="text-2xl md:text-3xl font-black text-emerald-400 mt-3">
                  {resumo.totalReceitas}
                </h2>
              </div>

              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </div>
        </section>

        <section className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mb-6">
          <button
            onClick={() => setFiltroAtivo("todas")}
            className={`px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap border transition-all ${
              filtroAtivo === "todas"
                ? "bg-white/8 text-white border-white/10"
                : "bg-black/20 text-gray-500 border-white/5 hover:text-gray-300"
            }`}
          >
            Todas ({resumo.totalCategorias})
          </button>

          <button
            onClick={() => setFiltroAtivo("despesa")}
            className={`px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap border transition-all flex items-center gap-2 ${
              filtroAtivo === "despesa"
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-black/20 text-gray-500 border-white/5 hover:text-gray-300"
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            Despesas ({resumo.totalDespesas})
          </button>

          <button
            onClick={() => setFiltroAtivo("receita")}
            className={`px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap border transition-all flex items-center gap-2 ${
              filtroAtivo === "receita"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-black/20 text-gray-500 border-white/5 hover:text-gray-300"
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            Receitas ({resumo.totalReceitas})
          </button>
        </section>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : categoriasFiltradas.length === 0 ? (
          <div className="glass-card rounded-[28px] p-10 text-center border border-white/5">
            <Tags className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Nenhuma categoria encontrada
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Crie suas primeiras categorias para deixar seus lançamentos mais bem
              organizados.
            </p>

            <button
              onClick={abrirModalNovo}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 px-5 py-3 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              <Plus className="w-5 h-5" />
              Nova categoria
            </button>
          </div>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {categoriasFiltradas.map((cat) => (
              <div
                key={cat.id}
                className="glass-card rounded-[26px] p-5 border border-white/5 card-hover"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${cat.cor || "#64748b"}20`,
                      border: `1px solid ${cat.cor || "#64748b"}30`,
                    }}
                  >
                    <div
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: cat.cor || "#64748b" }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{cat.nome}</h3>
                        <p
                          className={`text-[11px] font-bold uppercase tracking-[0.18em] mt-2 ${
                            cat.tipo === "receita" ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {cat.tipo}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-700 shrink-0 mt-1" />
                    </div>

                    <div className="mt-4 rounded-2xl bg-black/20 border border-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-widest text-gray-500 font-semibold">
                        Cor
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.cor || "#64748b" }}
                        />
                        <span className="text-sm text-gray-300">
                          {cat.cor || "#64748b"}
                        </span>
                      </div>
                    </div>
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
                    <h2 className="text-xl font-bold text-white">Nova categoria</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Crie uma categoria visual para receitas ou despesas
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
                <form id="nova-categoria-form" onSubmit={handleSalvar} className="space-y-6">
                  <div className="flex p-1 bg-black/20 rounded-2xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setTipo("despesa")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                        tipo === "despesa"
                          ? "bg-red-500/10 text-red-400 shadow-sm"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      Despesa
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipo("receita")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                        tipo === "receita"
                          ? "bg-emerald-500/10 text-emerald-400 shadow-sm"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      Receita
                    </button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Tags className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome da categoria (Ex: Uber, Lazer...)"
                      className="w-full pl-12 bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3">
                      Cor de identificação
                    </label>

                    <div className="grid grid-cols-6 gap-3">
                      {paletaCores.map((corHex) => (
                        <button
                          key={corHex}
                          type="button"
                          onClick={() => setCor(corHex)}
                          className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-transform active:scale-95 ${
                            cor === corHex ? "ring-2 ring-white/60 shadow-lg" : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: corHex }}
                          aria-label={`Selecionar cor ${corHex}`}
                        >
                          {cor === corHex && <Check className="w-5 h-5 text-white" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] bg-black/20 border border-white/5 p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-[11px] font-semibold uppercase tracking-[0.18em] mb-4">
                      <Palette className="w-4 h-4" />
                      Pré-visualização
                    </div>

                    <div className="glass-card rounded-[22px] p-4 border border-white/5">
                      <div className="flex items-start gap-4">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${cor}20`,
                            border: `1px solid ${cor}30`,
                          }}
                        >
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cor }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-white truncate">
                            {previewTitulo}
                          </h3>
                          <p
                            className={`text-[11px] font-bold uppercase tracking-[0.18em] mt-2 ${
                              tipo === "receita" ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {tipo}
                          </p>
                        </div>
                      </div>
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
                  form="nova-categoria-form"
                  disabled={isSaving || !nome.trim()}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-105 text-gray-950 rounded-2xl text-base font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar categoria"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}