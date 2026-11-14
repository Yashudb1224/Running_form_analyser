"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, BookOpen, ChevronsLeft, ChevronsRight, Dumbbell, FileBarChart, LineChart, LogOut, Menu, Monitor, Moon,
  PlusCircle, ShieldCheck, Sun, X,
} from "lucide-react";
import { ThemePreference, useTheme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { GoogleIcon } from "./GoogleIcon";

export type AppView = "report" | "new" | "progress" | "trainer" | "guide";

type NavIcon = (props: { active: boolean }) => React.ReactNode;

interface NavItem {
  view: AppView;
  label: string;
  icon: NavIcon;
  hint?: string;
}

const lucide = (Icon: typeof Activity): NavIcon => function NavLucideIcon({ active }) {
  return <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-muted group-hover:text-primary"}`} aria-hidden="true" />;
};

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Match system theme", icon: Monitor },
];

const SIDEBAR = { min: 200, max: 360, default: 256, collapsed: 76 } as const;
const STORAGE_KEY = "stride-lab-sidebar";
/** How far past the collapsed rail the cursor can be and still open the sidebar. */
const HOVER_REACH = 24;

interface AppShellProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  /** Label for the current report entry, shown when a report is open or being analysed. */
  reportLabel: string | null;
  children: React.ReactNode;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md">
        <Activity className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-ink">Stride <span className="text-gradient">Lab</span></p>
          <p className="truncate text-[11px] font-medium text-muted">Running form analysis</p>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ view, onNavigate, reportLabel, collapsed = false }: Omit<AppShellProps, "children"> & { collapsed?: boolean }) {
  const { preference, setPreference } = useTheme();
  const auth = useAuth();
  const items: NavItem[] = [
    ...(reportLabel ? [{ view: "report" as const, label: "Current report", icon: lucide(FileBarChart), hint: reportLabel }] : []),
    { view: "new", label: "New analysis", icon: lucide(PlusCircle) },
    { view: "progress", label: "Progress", icon: lucide(LineChart) },
    { view: "trainer", label: "Trainer", icon: lucide(Dumbbell) },
    { view: "guide", label: "Metric guide", icon: lucide(BookOpen) },
  ];
  const currentTheme = THEME_OPTIONS.find((option) => option.value === preference) ?? THEME_OPTIONS[2];
  const nextTheme = THEME_OPTIONS[(THEME_OPTIONS.indexOf(currentTheme) + 1) % THEME_OPTIONS.length];

  return (
    <div className={`flex h-full flex-col gap-6 py-4 ${collapsed ? "items-center px-2" : "px-4"}`}>
      <Brand compact={collapsed} />

      <nav aria-label="Main" className="w-full flex-1">
        <ul className="space-y-1">
          {items.map(({ view: itemView, label, icon: Icon, hint }) => {
            const active = view === itemView;
            return (
              <li key={itemView}>
                <button
                  type="button"
                  onClick={() => onNavigate(itemView)}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                  className={`group flex w-full items-center rounded-xl py-2.5 text-left text-sm font-medium transition duration-150 active:scale-[0.98] ${
                    collapsed ? "justify-center px-0" : "gap-3 px-3"
                  } ${active ? "bg-button-gradient text-white shadow-md" : "text-body hover:bg-subtle hover:text-ink"}`}
                >
                  <Icon active={active} />
                  {!collapsed && (
                    <span className="min-w-0">
                      <span className="block truncate">{label}</span>
                      {hint && <span className={`block truncate text-[11px] ${active ? "text-white/80" : "text-muted"}`}>{hint}</span>}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="w-full space-y-3">
        {!collapsed && (
          <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            Videos are processed in your browser
          </p>
        )}
        {collapsed ? (
          <button
            type="button"
            onClick={() => setPreference(nextTheme.value)}
            className="control-button h-10 w-full min-h-0 px-0"
            title={`${currentTheme.label} (click for ${nextTheme.label.toLowerCase()})`}
            aria-label={`Theme: ${currentTheme.label}. Switch to ${nextTheme.label}`}
          >
            <currentTheme.icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
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
        )}
        {auth.enabled && !auth.loading && (auth.user ? (
          <div className={`flex items-center rounded-xl border border-border/70 bg-surface/70 p-2 ${collapsed ? "flex-col gap-2" : "gap-2.5"}`}>
            {auth.user.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- profile photo URL from Clerk
              <img src={auth.user.imageUrl} alt="" title={auth.user.name} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border border-border" />
            ) : (
              <span title={auth.user.name} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                {auth.user.name.charAt(0).toUpperCase()}
              </span>
            )}
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink">{auth.user.name}</span>
                {auth.user.email && <span className="block truncate text-[10px] text-muted">{auth.user.email}</span>}
              </span>
            )}
            <button type="button" onClick={() => void auth.signOut()} className="quiet-button min-h-8 px-2" title="Sign out" aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void auth.signInWithGoogle()}
            className={`control-button min-h-10 w-full ${collapsed ? "px-0" : ""}`}
            title={collapsed ? "Sign in with Google" : undefined}
            aria-label={collapsed ? "Sign in with Google" : undefined}
          >
            <GoogleIcon className="h-4 w-4" />{!collapsed && " Sign in with Google"}
          </button>
        ))}
      </div>
    </div>
  );
}

function readSidebarPreference(): { width: number; pinned: boolean } {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as { width?: number; pinned?: boolean };
    const width = typeof stored.width === "number" ? Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, stored.width)) : SIDEBAR.default;
    return { width, pinned: stored.pinned === true };
  } catch {
    return { width: SIDEBAR.default, pinned: false };
  }
}

/**
 * App layout: on large screens a sidebar that rests as an icon rail and slides open over the page
 * when the cursor comes near it (or it is pinned open and resizable); on small screens a top bar with
 * a slide-out menu. The sidebar's width and pinned state are remembered per browser.
 */
export function AppShell({ view, onNavigate, reportLabel, children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [width, setWidth] = useState<number>(SIDEBAR.default);
  const [pinned, setPinned] = useState(false);
  const [resizing, setResizing] = useState(false);
  // While unpinned, the sidebar opens over the page when the cursor (or keyboard focus) comes near.
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    const stored = readSidebarPreference();
    setWidth(stored.width);
    setPinned(stored.pinned);
  }, []);

  useEffect(() => () => {
    if (peekTimer.current) window.clearTimeout(peekTimer.current);
  }, []);

  const schedulePeek = (open: boolean) => {
    if (peekTimer.current) window.clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => setPeek(open), open ? 80 : 250);
  };

  const remember = useCallback((next: { width: number; pinned: boolean }) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode); the layout still works for this visit.
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (event: PointerEvent) => {
      if (!dragStart.current) return;
      setWidth(Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, dragStart.current.width + event.clientX - dragStart.current.x)));
    };
    const onUp = () => {
      setResizing(false);
      dragStart.current = null;
      setWidth((current) => {
        remember({ width: current, pinned: true });
        return current;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing, remember]);

  const togglePinned = () => {
    setPeek(false);
    setPinned((current) => {
      remember({ width, pinned: !current });
      return !current;
    });
  };

  const resizeWithKeyboard = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, width + (event.key === "ArrowRight" ? 16 : -16)));
    setWidth(next);
    remember({ width: next, pinned: true });
  };

  const navigate = (next: AppView) => {
    setMenuOpen(false);
    setPeek(false);
    onNavigate(next);
  };

  const expanded = pinned || peek;
  const floating = peek && !pinned;

  return (
    <div
      className="app-shell lg:pl-[var(--content-offset)]"
      style={{ "--sidebar-width": `${expanded ? width : SIDEBAR.collapsed}px`, "--content-offset": `${pinned ? width : SIDEBAR.collapsed}px` } as React.CSSProperties}
    >
      {!pinned && (
        // An invisible strip just right of the rail, so the sidebar opens when the cursor gets near it.
        <div
          aria-hidden="true"
          onMouseEnter={() => schedulePeek(true)}
          onMouseLeave={() => schedulePeek(false)}
          className="fixed inset-y-0 z-30 hidden lg:block"
          style={{ left: SIDEBAR.collapsed, width: HOVER_REACH }}
        />
      )}
      <aside
        onMouseEnter={() => !pinned && schedulePeek(true)}
        onMouseLeave={() => !pinned && schedulePeek(false)}
        onFocus={() => !pinned && setPeek(true)}
        onBlur={(event) => {
          if (!pinned && !event.currentTarget.contains(event.relatedTarget as Node | null)) setPeek(false);
        }}
        className={`fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-border/60 backdrop-blur-xl lg:block ${floating ? "bg-surface/95 shadow-2xl" : "bg-surface/70"} ${resizing ? "" : "transition-[width,box-shadow] duration-200 ease-out"}`}
      >
        <SidebarContent view={view} onNavigate={navigate} reportLabel={reportLabel} collapsed={!expanded} />
        <button
          type="button"
          onClick={togglePinned}
          className="absolute -right-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card transition hover:text-ink"
          aria-label={pinned ? "Unpin sidebar (open on hover)" : "Pin sidebar open"}
          aria-pressed={pinned}
          title={pinned ? "Unpin: open on hover" : "Pin open"}
        >
          {!pinned ? <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        {pinned && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuemin={SIDEBAR.min}
            aria-valuemax={SIDEBAR.max}
            aria-valuenow={width}
            tabIndex={0}
            onKeyDown={resizeWithKeyboard}
            onPointerDown={(event) => {
              dragStart.current = { x: event.clientX, width };
              setResizing(true);
            }}
            onDoubleClick={() => {
              setWidth(SIDEBAR.default);
              remember({ width: SIDEBAR.default, pinned: true });
            }}
            title="Drag to resize · double-click to reset"
            className={`absolute inset-y-0 -right-1 w-2 cursor-col-resize transition-colors hover:bg-primary/30 focus-visible:bg-primary/40 ${resizing ? "bg-primary/40" : ""}`}
          />
        )}
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
