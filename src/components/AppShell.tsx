"use client";

import React, { useEffect, useState } from "react";
import {
  Activity, BookOpen, FileBarChart, LineChart, LogOut, Menu, Monitor, Moon, PlusCircle, ShieldCheck, Sparkles, Sun, X,
} from "lucide-react";
import { ThemePreference, useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { GoogleIcon } from "./GoogleIcon";

export type AppView = "report" | "new" | "progress" | "coach" | "guide";

interface NavItem {
  view: AppView;
  label: string;
  icon: typeof Activity;
  hint?: string;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system theme", icon: Monitor },
];

interface AppShellProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  /** Label for the current report entry, shown when a report is open or being analysed. */
  reportLabel: string | null;
  children: React.ReactNode;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md">
        <Activity className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-bold tracking-tight text-ink">Stride <span className="text-gradient">Lab</span></p>
        <p className="text-[11px] font-medium text-muted">Running form analysis</p>
      </div>
    </div>
  );
}

function SidebarContent({ view, onNavigate, reportLabel }: Omit<AppShellProps, "children">) {
  const { preference, setPreference } = useTheme();
  const auth = useAuth();
  const items: NavItem[] = [
    ...(reportLabel ? [{ view: "report" as const, label: "Current report", icon: FileBarChart, hint: reportLabel }] : []),
    { view: "new", label: "New analysis", icon: PlusCircle },
    { view: "progress", label: "Progress", icon: LineChart },
    { view: "coach", label: "AI Coach", icon: Sparkles },
    { view: "guide", label: "Metric guide", icon: BookOpen },
  ];

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />

      <nav aria-label="Main" className="flex-1">
        <ul className="space-y-1">
          {items.map(({ view: itemView, label, icon: Icon, hint }) => {
            const active = view === itemView;
            return (
              <li key={itemView}>
                <button
                  type="button"
                  onClick={() => onNavigate(itemView)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition duration-150 active:scale-[0.98] ${
                    active ? "bg-button-gradient text-white shadow-md" : "text-body hover:bg-subtle hover:text-ink"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-muted group-hover:text-primary"}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block">{label}</span>
                    {hint && <span className={`block truncate text-[11px] ${active ? "text-white/80" : "text-muted"}`}>{hint}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-3">
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
          Videos are processed in your browser
        </p>
        <div className="flex rounded-xl border border-border bg-card p-0.5" role="radiogroup" aria-label="Color theme">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={preference === value}
              aria-label={label}
              title={label}
              onClick={() => setPreference(value)}
              className={`flex h-8 flex-1 items-center justify-center rounded-lg transition-colors ${
                preference === value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
        {auth.enabled && !auth.loading && (auth.user ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-surface/70 p-2">
            {auth.user.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- profile photo URL from Clerk
              <img src={auth.user.imageUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border border-border" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                {auth.user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-ink">{auth.user.name}</span>
              {auth.user.email && <span className="block truncate text-[10px] text-muted">{auth.user.email}</span>}
            </span>
            <button type="button" onClick={() => void auth.signOut()} className="quiet-button min-h-8 px-2" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => void auth.signInWithGoogle()} className="control-button min-h-10 w-full">
            <GoogleIcon className="h-4 w-4" /> Sign in with Google
          </button>
        ))}
      </div>
    </div>
  );
}

/** App layout: a fixed sidebar on large screens and a top bar with a slide-out menu on small ones. */
export function AppShell({ view, onNavigate, reportLabel, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const navigate = (next: AppView) => {
    setMenuOpen(false);
    onNavigate(next);
  };

  return (
    <div className="app-shell lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border/60 bg-surface/70 backdrop-blur-xl lg:block">
        <SidebarContent view={view} onNavigate={navigate} reportLabel={reportLabel} />
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-surface/80 px-4 backdrop-blur-xl lg:hidden">
        <Brand />
        <button type="button" onClick={() => setMenuOpen(true)} className="control-button h-9 w-9 min-h-0 px-0" aria-label="Open menu" aria-expanded={menuOpen}>
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="rise-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface shadow-raised">
            <button type="button" onClick={() => setMenuOpen(false)} className="quiet-button absolute right-2 top-3 h-9 w-9 min-h-0 px-0" aria-label="Close menu">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent view={view} onNavigate={navigate} reportLabel={reportLabel} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1320px] px-4 pb-16 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}
