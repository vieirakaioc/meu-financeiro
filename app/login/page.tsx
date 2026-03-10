"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setMode("login");
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw new Error(error.message);

      router.replace("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erro ao entrar.");
    } finally {
      setLoading(false);
      setMode(null);
    }
  };

  const handleSignUp = async () => {
    if (loading) return;

    setLoading(true);
    setMode("signup");
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) throw new Error(error.message);

      setMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro.");
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
      setMode(null);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#070b12] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_20%),radial-gradient(circle_at_bottom_center,rgba(139,92,246,0.10),transparent_24%)]" />

      <div className="relative min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex items-center justify-center px-10 py-12">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.18em]">
              <Sparkles className="w-3.5 h-3.5" />
              financepro
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight leading-tight">
              Seu financeiro,
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                com cara de app.
              </span>
            </h1>

            <p className="mt-5 text-base text-gray-400 leading-relaxed max-w-lg">
              Controle contas, cartões, metas, orçamento e relatórios em um lugar
              só, com leitura boa no celular e no desktop.
            </p>

            <div className="mt-10 grid gap-4">
              <div className="glass-card rounded-[24px] p-5 border border-white/5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Tudo organizado</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Entradas, saídas, metas e relatórios sem virar bagunça.
                    </p>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[24px] p-5 border border-white/5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <ArrowRight className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Rápido de usar</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Você bate o olho e já entende o que está acontecendo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">
            <div className="glass-card-strong rounded-[30px] border border-white/10 p-6 sm:p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold uppercase tracking-[0.18em] lg:hidden">
                  <Sparkles className="w-3.5 h-3.5" />
                  financepro
                </div>

                <h2 className="text-3xl font-black text-white mt-4">Entrar</h2>
                <p className="text-gray-400 mt-2 text-sm">
                  Acesse sua área financeira
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3">
                    E-mail
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-500" />
                    </div>

                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-12 bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-3">
                    Senha
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-500" />
                    </div>

                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-12 bg-black/20 border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {message}
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl text-base font-bold text-gray-950 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:brightness-105 disabled:opacity-50 transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20"
                  >
                    {loading && mode === "login" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl text-base font-bold text-white bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {loading && mode === "signup" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      "Criar nova conta"
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-6 pt-6 border-t border-white/5 text-center">
                <p className="text-xs text-gray-500">
                  Controle financeiro mais limpo, rápido e visual.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}