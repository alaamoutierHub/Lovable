// Minimal Tailwind UI primitives. shadcn/ui can replace/extend these later in Lovable.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

function cx(...c: Array<string | false | undefined | null>): string {
  return c.filter(Boolean).join(" ");
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }
>(function Button({ className, variant = "primary", ...props }, ref) {
  const styles = {
    primary: "bg-brand text-brand-fg hover:opacity-90",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];
  return (
    <button
      ref={ref}
      className={cx(
        "inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { error?: boolean; prefix?: string; suffix?: string }
>(function Input({ className, error, prefix, suffix, ...props }, ref) {
  const base = cx(
    "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-1 dark:bg-slate-800 dark:text-slate-100",
    error
      ? "border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
      : "border-slate-300 focus:border-brand focus:ring-brand dark:border-slate-600",
  );
  const input = <input ref={ref} className={cx(base, (prefix || suffix) && "text-right", className)} {...props} />;
  if (!prefix && !suffix) return input;
  // Affix wrapper (currency prefix / unit suffix) keeps the input flush.
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-400">{prefix}</span>}
      <input
        ref={ref}
        className={cx(base, prefix && "pl-11", suffix && "pr-10", className)}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-slate-400">{suffix}</span>}
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }
>(function Select({ className, error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cx(
        "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-1 dark:bg-slate-800 dark:text-slate-100",
        error
          ? "border-red-400 focus:border-red-500 focus:ring-red-500 dark:border-red-500"
          : "border-slate-300 focus:border-brand focus:ring-brand dark:border-slate-600",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string; // inline help shown under the label
  error?: string; // validation message shown under the field (red)
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
        {label}
        {required && <span className="text-red-500" title="Required">*</span>}
      </span>
      {hint && !error && <span className="mb-1 block text-[0.7rem] font-normal text-slate-400">{hint}</span>}
      {children}
      {error && <span className="mt-1 block text-[0.7rem] font-medium text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "red" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  }[tone];
  return <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium", tones)}>{children}</span>;
}
