'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Login failed');
      router.push('/home');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/icon.svg" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-lg" />
          <h1 className="text-2xl font-bold text-brand-900">TaskFlow</h1>
          <p className="text-sm text-gray-500 mt-1">Your team&apos;s task tracker</p>
        </div>
        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <span className="label">Email</span>
            <input suppressHydrationWarning className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <span className="label">Password</span>
            <input suppressHydrationWarning className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
          <button suppressHydrationWarning className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="card mt-4 p-4 text-xs text-gray-500 leading-relaxed">
          <div className="font-semibold text-gray-700 mb-1">Demo logins (password: password123)</div>
          admin@rentfoxxy.com (CTO) · ceo@rentfoxxy.com<br />
          Heads: suresh (Sales) · manoj (Warehouse) · deepak (Support) · meena (Accounts)<br />
          Members: neha, amit, sunil, rekha, anjali, vikas, ravi — all @rentfoxxy.com
        </div>
      </div>
    </div>
  );
}
