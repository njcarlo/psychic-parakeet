import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-full bg-coastal-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-coastal-700 disabled:cursor-not-allowed disabled:bg-slate-300 ${className}`}
    />
  );
}

export function SecondaryButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-full border border-coastal-200 bg-white/75 px-4 py-2 text-sm font-bold text-coastal-700 transition hover:bg-coastal-50 disabled:cursor-not-allowed disabled:text-slate-400 ${className}`}
    />
  );
}

export function DangerButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 ${className}`}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-coastal-100 bg-white/90 px-4 py-3 text-sm text-slate-800 outline-none ring-coastal-500/20 transition placeholder:text-slate-400 focus:border-coastal-500 focus:ring-4 ${className}`}
    />
  );
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-coastal-100 bg-white/90 px-4 py-3 text-sm text-slate-800 outline-none ring-coastal-500/20 transition focus:border-coastal-500 focus:ring-4 ${className}`}
    />
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-coastal-100 bg-white/90 px-4 py-3 text-sm text-slate-800 outline-none ring-coastal-500/20 transition placeholder:text-slate-400 focus:border-coastal-500 focus:ring-4 ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-coastal-900">{label}</span>
      {children}
    </label>
  );
}

export function Alert({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'success' }) {
  const style =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-sky-200 bg-sky-50 text-sky-800';

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${style}`}>{children}</div>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/70 bg-white/72 p-5 shadow-sm ${className}`}>{children}</section>;
}
