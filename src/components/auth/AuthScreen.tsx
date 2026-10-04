import { useState } from 'react';
import { Ticket } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorText, rememberSession, setRememberSession } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

export default function AuthScreen() {
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const resetPassword = useAuthStore(s => s.resetPassword);

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(rememberSession);

  async function submit() {
    if (!email.trim() || !password) return;
    setBusy(true);
    setRememberSession(remember);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        const { needsEmail } = await signUp(email, password, displayName || email.split('@')[0]);
        if (needsEmail) toast.success('Check your inbox, the account needs the emailed link first');
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) {
      toast.error('Type the email first');
      return;
    }
    try {
      await resetPassword(email);
      toast.success('Reset link sent');
    } catch (err) {
      toast.error(errorText(err));
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Ticket size={17} strokeWidth={1.6} />
          </div>
          <CardTitle>Issue Cards</CardTitle>
          <CardDescription>Shared issue tracking, one account per person.</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">Log in</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signup" className="space-y-2 pt-4">
              <Label htmlFor="auth-name">Display name</Label>
              <Input
                id="auth-name"
                value={displayName}
                placeholder="What the other person sees"
                onChange={e => setDisplayName(e.target.value)}
              />
            </TabsContent>

            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void submit()}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="auth-remember"
                  checked={remember}
                  onCheckedChange={value => setRemember(value === true)}
                />
                <Label htmlFor="auth-remember" className="text-muted-foreground font-normal">
                  Keep me logged in
                </Label>
              </div>

              <Button className="w-full" disabled={busy} onClick={() => void submit()}>
                {mode === 'signin' ? 'Log in' : 'Sign up'}
              </Button>

              {mode === 'signin' && (
                <Button variant="link" className="w-full" onClick={() => void forgot()}>
                  Forgot the password
                </Button>
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
