import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserSession } from '@/contexts/UserSessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LogIn, Ticket, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCPF, cleanCPF } from '@/lib/cpf-utils';
import { getSupabaseClient } from '@/lib/supabase-external';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, user, loading: sessionLoading } = useUserSession();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  // Check if any admin exists - if not, redirect to first access
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const db = await getSupabaseClient();
        const { data, error } = await db
          .from('user_permissions')
          .select('user_id')
          .eq('is_admin', true)
          .limit(1);

        if (cancelled) return;
        if (error) {
          console.warn('Erro ao verificar admin:', error.message);
          setHasAdmin(true); // assume exists on error
          return;
        }
        setHasAdmin((data?.length ?? 0) > 0);
      } catch {
        if (!cancelled) setHasAdmin(true);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  // Redirect to first access if no admin exists
  useEffect(() => {
    if (hasAdmin === false) navigate('/cadastro', { replace: true });
  }, [hasAdmin, navigate]);

  if (sessionLoading || user || hasAdmin === null) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfClean = cleanCPF(cpf);

    if (!cpfClean || !password) return;

    if (cpfClean.length !== 11) {
      toast({ title: 'CPF inválido', description: 'Informe os 11 dígitos do CPF.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await signIn(cpfClean, password);
    setLoading(false);

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message || 'CPF ou senha incorretos.',
        variant: 'destructive',
      });
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 bg-primary rounded-xl w-fit mb-2">
            <Ticket className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>Acesse o sistema com seu CPF e senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <Link to="/esqueci-senha" className="text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
