'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg">
            <span className="text-lg font-black">TF</span>
          </div>
          <h1 className="text-2xl font-bold">TaskFlow</h1>
          <p className="mt-1 text-sm text-muted-foreground">Task Management System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your RentFoxxy work email</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  suppressHydrationWarning
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  suppressHydrationWarning
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              {err && (
                <Alert variant="destructive">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={busy} suppressHydrationWarning>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            <div className="mb-1 font-semibold text-foreground">Demo logins (password: password123)</div>
            admin@rentfoxxy.com (CTO) · ceo@rentfoxxy.com
            <br />
            Heads: suresh (Sales) · manoj (Warehouse) · deepak (Support) · meena (Accounts)
            <br />
            Members: neha, amit, sunil, rekha, anjali, vikas, ravi — all @rentfoxxy.com
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
