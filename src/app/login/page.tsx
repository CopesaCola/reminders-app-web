'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarCheck, LoaderCircle } from 'lucide-react';

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) router.push(next);
    else setError('Wrong password');
  }

  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <form onSubmit={submit} className="card p-7 w-full max-w-sm space-y-5 animate-fade-in">
        <div className="flex flex-col items-center text-center gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-accent-solid text-accent-fg shadow-card">
            <CalendarCheck size={24} strokeWidth={2.5} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Goal Tracking</h1>
            <p className="text-sm text-muted mt-1">Enter your password to continue</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            autoFocus
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p role="alert" className="text-sm text-bad pt-0.5">
              {error}
            </p>
          )}
        </div>
        <button className="btn-primary w-full" disabled={loading || !password}>
          {loading ? (
            <>
              <LoaderCircle size={16} className="animate-spin" />
              Checking…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
