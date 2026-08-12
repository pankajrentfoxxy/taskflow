'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api, setLoggedIn, toast } from '@/lib/util';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setLoggedIn();
      router.push('/home');
    } catch (e: any) {
      setErr(e.message);
      toast.errorFrom(e, 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const openReset = () => {
    setResetOpen(true);
    setResetEmail(email);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setResetErr('');
    setResetMsg('');
  };

  const closeReset = () => {
    setResetOpen(false);
    setResetErr('');
    setResetMsg('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');

    if (newPassword !== confirmPassword) {
      const msg = 'New passwords do not match';
      setResetErr(msg);
      toast.error(msg);
      return;
    }

    setResetBusy(true);
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: resetEmail,
          oldPassword,
          newPassword,
          confirmPassword,
        }),
      });
      toast.success('Password updated');
      setPassword('');
      closeReset();
    } catch (e: any) {
      setResetErr(e.message);
      toast.errorFrom(e);
    } finally {
      setResetBusy(false);
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
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={openReset}
                >
                  Reset password
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Modal open={resetOpen} onClose={closeReset} title="Reset password">
        <form onSubmit={submitReset} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your email, current password, and choose a new password.
          </p>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="old-password">Current password</Label>
            <Input
              id="old-password"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="h-10"
            />
          </div>
          {resetErr && (
            <Alert variant="destructive">
              <AlertDescription>{resetErr}</AlertDescription>
            </Alert>
          )}
          {resetMsg && (
            <Alert>
              <AlertDescription>{resetMsg}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeReset} disabled={resetBusy}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={resetBusy}>
              {resetBusy ? 'Updating…' : 'Update password'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
