'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
    <main className="min-h-screen grid place-items-center px-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Goal Tracking</h1>
        <p className="text-sm text-muted">Enter your password to continue.</p>
        <input
          autoFocus
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={loading || !password}>
          {loading ? 'Checking…' : 'Sign in'}
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
