import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { MASCOT_NAME, Mascot } from "./Mascot";

const GREETINGS = [
  "Hellooo! I'm Dash. Need a hand with your running?",
  "Hey runner! Want me to look at your form?",
  "Hellooo! Ask me to compare your runs!",
];

/** Big Dash with a speech bubble, for the top of the chat panel when there is nothing else to show yet. */
export function DashHello({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-3">
      <Mascot size={150} variant="full" mood="happy" />
      <p className="dash-bubble mb-14 rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-base font-semibold text-ink shadow-xl">{text}</p>
    </div>
  );
}

/**
 * Dash floats in the corner with a greeting; clicking him slides the chat panel in from the right.
 * The panel stays mounted while closed so a conversation survives closing and reopening it.
 */
export function DashLauncher({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const [greeting, setGreeting] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Keep a closed panel out of the tab order and away from screen readers.
  useEffect(() => {
    panelRef.current?.toggleAttribute("inert", !open);
  }, [open]);

  // Say hello shortly after the page loads, then tuck the bubble away after a while.
  useEffect(() => {
    const show = window.setTimeout(() => setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]), 900);
    const hide = window.setTimeout(() => setGreeting(null), 12000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setGreeting(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  return (
    <>
      {!open && (
        <div className="fixed bottom-3 right-3 z-40 flex items-end gap-1 sm:bottom-5 sm:right-5">
          {greeting && (
            <div className="dash-bubble relative mb-16 max-w-[12rem] sm:mb-24 sm:max-w-[13rem] rounded-2xl rounded-br-sm border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-ink shadow-xl">
              {greeting}
              <button
                type="button"
                onClick={() => setGreeting(null)}
                className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card hover:text-ink"
                aria-label="Dismiss greeting"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            onMouseEnter={() => setGreeting((current) => current ?? GREETINGS[0])}
            className="dash-launcher rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            aria-label={`Chat with ${MASCOT_NAME}, your AI running buddy`}
            title={`Chat with ${MASCOT_NAME}`}
          >
            <span className="relative block h-[124px] w-[105px] sm:h-[177px] sm:w-[150px]"><span className="absolute bottom-0 right-0 origin-bottom-right scale-[0.7] sm:scale-100"><Mascot size={150} variant="full" className="drop-shadow-xl" /></span></span>
          </button>
        </div>
      )}

      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Close ${MASCOT_NAME}`}
          onClick={() => onOpenChange(false)}
          className={`absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-label={`Chat with ${MASCOT_NAME}`}
          className={`absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-border/70 bg-background shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
          ref={panelRef}
        >
          <header className="flex items-center justify-between border-b border-border/70 bg-surface/80 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <Mascot size={36} mood="happy" />
              <div>
                <p className="text-sm font-semibold text-ink">{MASCOT_NAME}</p>
                <p className="text-xs text-muted">Your AI running buddy · powered by Google Gemini</p>
              </div>
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="control-button h-9 w-9 px-0" aria-label={`Close ${MASCOT_NAME}`}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        </section>
      </div>
    </>
  );
}
