import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserPlus, Ticket, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCPF, cleanCPF, isValidCPF } from '@/lib/cpf-utils';
import { getSupabaseClient } from '@/lib/supabase-external';

export default function Cadastro() {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // If admin already exists, redirect to login
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const db = await getSupabaseClient();
        const { data } = await db
          .from('user_permissions')
          .select('user_id')
          .eq('is_admin', true)
          .limit(1);

        if (cancelled) return;
        if (data && data.length > 0) {
          navigate('/login', { replace: true });
          return;
        }
      } catch {
        // allow access on error
      }
      if (!cancelled) setChecking(false);
    };
    check();
    return () => { cancelled = true; };
  }, [navigate]);

  if (checking) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfClean = cleanCPF(cpf);

    if (!nome.trim() || !cpfClean || !email || !password) return;

    if (!isValidCPF(cpfClean)) {
      toast({ title: 'CPF inválido', description: 'Verifique o CPF informado.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Erro', description: 'As senhas não coincidem.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Erro', description: 'A senha deve ter pelo menos 6 caracteres.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/create-first-admin`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          password,
          cpf: cpfClean,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);

      toast({ title: 'Cadastro realizado!', description: 'Conta administrador criada. Faça login.' });
      navigate('/login');
    } catch (err: any) {
      toast({ title: 'Erro ao cadastrar', description: err.message || 'Erro de conexão.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 bg-primary rounded-xl w-fit mb-2">
            <Ticket className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Primeiro Acesso</CardTitle>
          <CardDescription>Crie a conta do administrador do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF * <span className="text-xs text-muted-foreground">(usado para login)</span></Label>
              <Input
                id="cpf"
                inputMode="numeric"
                value={cpf}
                onChange={e => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email * <span className="text-xs text-muted-foreground">(para recuperação de senha)</span></Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar Senha *</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirme sua senha" required disabled={loading} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              {loading ? 'Cadastrando...' : 'Criar Conta Administrador'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
