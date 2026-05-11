import { useEffect, useRef, useState } from "react";
import { usePremium, haptic } from "./PremiumContext";

const ACCESS_CODE = "0250";

export function DevPanelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setPremium } = usePremium();
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCode("");
      setShake(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, code]);

  if (!open) return null;

  function submit() {
    if (code.trim() === ACCESS_CODE) {
      haptic(20);
      setPremium(true);
      onClose();
    } else {
      console.error("[DevPanel] invalid access code");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Dev Testing Panel"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-sm rounded-2xl border border-neon/40 bg-card p-6 glow-neon ${
          shake ? "animate-pulse" : ""
        }`}
        style={shake ? { animation: "shake 0.4s" } : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-glow rounded-full bg-neon" />
          <h2 className="font-display text-base font-bold text-neon tracking-wide">
            Dev Testing Panel
          </h2>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Restricted access · internal QA
        </p>

        <label className="mt-5 block">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Access Code
          </span>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter Access Code"
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground tracking-[0.3em] outline-none focus:border-neon/60 focus:ring-1 focus:ring-neon/40"
          />
        </label>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-transparent py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground transition hover:bg-muted/30"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-lg border border-neon/60 bg-neon/15 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-neon transition hover:bg-neon/25 glow-neon"
          >
            Accept Password
          </button>
        </div>
      </div>
    </div>
  );
}
