"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  CreditCard,
  PieChart,
  Target,
  BarChart3,
  Tags,
  LogOut,
  Plus,
  Sparkles,
  ChevronRight,
  CalendarDays,
  TrendingUp,
} from "lucide-react";
import { supabase } from "../lib/supabase";

type MenuItem = {
  name: string;
  icon: any;
  href: string;
  mobile?: boolean;
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems: MenuItem[] = [
    { name: "Início", icon: LayoutDashboard, href: "/", mobile: true },
    { name: "Lançamentos", icon: ArrowRightLeft, href: "/lancamentos", mobile: true },
    { name: "Planejamento", icon: CalendarDays, href: "/planejamento", mobile: true },
    { name: "Investimentos", icon: TrendingUp, href: "/investimentos", mobile: true },
    { name: "Contas", icon: Wallet, href: "/contas" },
    { name: "Cartões", icon: CreditCard, href: "/cartoes" },
    { name: "Categorias", icon: Tags, href: "/categorias" },
    { name: "Orçamento", icon: PieChart, href: "/orcamento" },
    { name: "Metas", icon: Target, href: "/metas" },
    { name: "Relatórios", icon: BarChart3, href: "/relatorios" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 z-50 h-screen w-[272px] px-4 py-4">
        <div className="glass-card-strong w-full rounded-[32px] border border-white/5 overflow-hidden flex flex-col">
          <Link
            href="/"
            className="relative p-6 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_22%)]" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                financepro
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
                Controle e
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                  projeção
                </span>
              </h2>

              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Passado, presente e futuro do seu caixa.
              </p>
            </div>
          </Link>

          <div className="p-4">
            <Link
              href="/lancamentos"
              className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-gray-950 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-black/10 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm leading-none">Novo lançamento</p>
                  <p className="text-[11px] text-black/65 mt-1 font-semibold">
                    Entrada ou saída
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <nav className="flex-1 px-3 pb-3 overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all border ${
                      active
                        ? "bg-white/8 text-white border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                        : "text-gray-400 border-transparent hover:bg-white/[0.035] hover:text-white"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                        active
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/[0.03] text-gray-500 border border-white/5 group-hover:text-gray-300"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${active ? "text-white" : ""}`}>
                        {item.name}
                      </p>
                    </div>

                    {active && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="p-3 border-t border-white/5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/15 transition-all"
            >
              <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <LogOut className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Sair</p>
                <p className="text-[11px] text-gray-600">Encerrar sessão</p>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-50 no-tap-highlight">
        <div className="glass-card-strong rounded-[28px] border border-white/10 px-2 py-2 shadow-2xl">
          <div className="grid grid-cols-5 items-end gap-1">
            {menuItems
              .filter((item) => item.mobile)
              .slice(0, 2)
              .map((item) => (
                <MobileNavItem
                  key={item.name}
                  href={item.href}
                  icon={item.icon}
                  label={item.name}
                  active={isActive(item.href)}
                />
              ))}

            <Link
              href="/lancamentos"
              className="flex justify-center"
              aria-label="Novo lançamento"
            >
              <div className="w-15 h-15 -mt-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-400 text-gray-950 shadow-[0_14px_30px_rgba(16,185,129,0.35)] border-4 border-[#0b1017] flex items-center justify-center active:scale-95 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
            </Link>

            {menuItems
              .filter((item) => item.mobile)
              .slice(2, 4)
              .map((item) => (
                <MobileNavItem
                  key={item.name}
                  href={item.href}
                  icon={item.icon}
                  label={item.name}
                  active={isActive(item.href)}
                />
              ))}
          </div>
        </div>
      </nav>
    </>
  );
}

type MobileNavItemProps = {
  href: string;
  icon: any;
  label: string;
  active: boolean;
};

function MobileNavItem({
  href,
  icon: Icon,
  label,
  active,
}: MobileNavItemProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-1.5 px-1 py-2 rounded-2xl transition-all ${
        active ? "text-white" : "text-gray-500"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
          active
            ? "bg-emerald-500/12 text-emerald-400 border border-emerald-500/15"
            : "bg-transparent"
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>

      <span
        className={`text-[10px] font-semibold leading-none ${
          active ? "text-white" : "text-gray-500"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}