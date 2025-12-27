import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DoctorOnboardingForm } from '@/components/doctor-onboarding/DoctorOnboardingForm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, Building2, AlertTriangle, Stethoscope, RefreshCw } from 'lucide-react';

interface ClinicaInfo {
  id: string;
  nome: string;
  logo_url?: string;
}

export default function DoctorOnboarding() {
  const { clinicaId } = useParams<{ clinicaId: string }>();
  const [clinica, setClinica] = useState<ClinicaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchClinica() {
      if (!clinicaId) {
        setError('ID da clínica não fornecido');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('clientes')
          .select('id, nome, logo_url')
          .eq('id', clinicaId)
          .eq('ativo', true)
          .single();

        if (fetchError) {
          console.error('Erro ao buscar clínica:', fetchError);
          setError('Clínica não encontrada');
        } else if (!data) {
          setError('Clínica não encontrada ou inativa');
        } else {
          setClinica(data);
        }
      } catch (err) {
        console.error('Erro:', err);
        setError('Erro ao carregar dados da clínica');
      } finally {
        setLoading(false);
      }
    }

    fetchClinica();
  }, [clinicaId]);

  const handleSuccess = () => {
    setSuccess(true);
  };

  const handleNewRegistration = () => {
    setSuccess(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !clinica) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-destructive/10 mb-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Erro</h2>
            <p className="text-muted-foreground mb-6">{error || 'Clínica não encontrada'}</p>
            <p className="text-sm text-muted-foreground">
              Verifique se o link está correto ou entre em contato com o suporte.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <CheckCircle className="h-16 w-16 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Cadastro Realizado!</h2>
            <p className="text-muted-foreground mb-6">
              O médico foi cadastrado com sucesso no sistema da clínica{' '}
              <span className="font-semibold text-foreground">{clinica.nome}</span>.
            </p>
            <div className="space-y-3 w-full">
              <Button onClick={handleNewRegistration} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Cadastrar Outro Médico
              </Button>
              <p className="text-xs text-muted-foreground">
                Você pode fechar esta página ou cadastrar outro médico.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            {clinica.logo_url ? (
              <img 
                src={clinica.logo_url} 
                alt={clinica.nome} 
                className="h-12 w-auto object-contain"
              />
            ) : (
              <div className="p-3 rounded-xl bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Cadastro de Médico
          </h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Stethoscope className="h-4 w-4" />
            <span>{clinica.nome}</span>
          </div>
        </div>

        {/* Form */}
        <DoctorOnboardingForm 
          clienteId={clinica.id}
          onSuccess={handleSuccess}
        />

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>Powered by InovaIA</p>
        </div>
      </div>
    </div>
  );
}
