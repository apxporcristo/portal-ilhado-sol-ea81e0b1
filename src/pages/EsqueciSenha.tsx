import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getAuthClient, getSupabaseClient } from '@/lib/supabase-external';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cleanCPF } from '@/lib/cpf-utils';

export default function EsqueciSenha() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      let email = input.trim();

      // If input looks like CPF (only digits or formatted CPF), look up email
      const cleaned = cleanCPF(input);
      if (cleaned && /^\d{11}$/.test(cleaned)) {
        const db = await getSupabaseClient();
        const { data, error } = await db
          .from('user_profiles')
          .select('email')
          .eq('cpf', cleaned)
          .maybeSingle();

        if (error || !data) {
          toast({ title: 'CPF não encontrado', description: 'Nenhuma conta vinculada a este CPF.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        email = (data as any).email;
      }

      if (!email || !email.includes('@')) {
        toast({ title: 'Erro', description: 'Informe um CPF ou email válido.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const client = await getAuthClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        setSent(true);
        toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada.' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Falha ao enviar email.', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Esqueci minha senha</CardTitle>
          <CardDescription>Informe seu CPF ou email para redefinir a senha</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <Mail className="h-12 w-12 text-primary mx-auto" />
              <p className="text-muted-foreground">
                Um link de redefinição foi enviado. Verifique sua caixa de entrada.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="input">CPF ou Email</Label>
                <Input
                  id="input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="000.000.000-00 ou email@exemplo.com"
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </Button>
              <Link to="/login" className="block text-center text-sm text-primary hover:underline">
                Voltar ao login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
