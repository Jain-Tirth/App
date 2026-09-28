import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Shield, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (token: string, name: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(email, password);
      onLogin(response.accessToken, response.admin.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-white shadow-subtle">
            <Shield className="h-5 w-5" />
          </div>
          <div className="text-left">
            <span className="block text-sm font-semibold tracking-tight text-white">Dhobi Matrimony</span>
            <span className="block text-xs uppercase tracking-widest text-neutral-400">Admin Control</span>
          </div>
        </div>

        <Card className="border-neutral-800 bg-neutral-950/80 shadow-elevated backdrop-blur-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold tracking-tight text-white">
              Authentication
            </CardTitle>
            <CardDescription className="text-sm text-neutral-400">
              Enter your administrative credentials to access moderation tools.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-2">
              {error ? (
                <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900/90 p-3 text-xs text-neutral-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-white" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                  <Input
                    className="pl-9"
                    placeholder="admin@dhobimatrimony.com"
                    type="email"
                    value={email}
                    autoComplete="email"
                    required
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
                  <Input
                    className="pl-9"
                    placeholder="••••••••"
                    type="password"
                    value={password}
                    autoComplete="current-password"
                    required
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full justify-center gap-2 font-medium"
              >
                {loading ? 'Authenticating...' : 'Sign In to Console'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-neutral-600">
          Strictly authorized personnel only. All access attempts are audited.
        </p>
      </div>
    </div>
  );
}
