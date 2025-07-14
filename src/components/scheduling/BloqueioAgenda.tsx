import React, { useState, useEffect } from 'react';
import { Calendar, AlertTriangle, Clock, User, FileText, Check, ChevronsUpDown, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
}

interface BloqueioAgendaProps {
  onBack?: () => void;
}

export const BloqueioAgenda: React.FC<BloqueioAgendaProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [loadingMedicos, setLoadingMedicos] = useState(true);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicoId, setMedicoId] = useState('');
  const [openCombobox, setOpenCombobox] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  // Carregar médicos diretamente da base de dados
  useEffect(() => {
    const carregarMedicos = async () => {
      try {
        setLoadingMedicos(true);
        console.log('🔍 Carregando médicos da base de dados...');
        
        const { data, error } = await supabase
          .from('medicos')
          .select('id, nome, especialidade')
          .eq('ativo', true)
          .order('nome');

        if (error) {
          console.error('❌ Erro ao carregar médicos:', error);
          throw error;
        }

        console.log('✅ Médicos carregados:', data);
        setMedicos(data || []);
      } catch (error) {
        console.error('❌ Erro ao carregar médicos:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar a lista de médicos",
          variant: "destructive",
        });
      } finally {
        setLoadingMedicos(false);
      }
    };

    carregarMedicos();
  }, [toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!medicoId || !dataInicio || !dataFim || !motivo) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (new Date(dataInicio) > new Date(dataFim)) {
      toast({
        title: "Erro",
        description: "A data de início deve ser anterior ou igual à data de fim",
        variant: "destructive",
      });
      return;
    }

    setShowConfirmation(true);
  };

  const handleBloqueioAgenda = async () => {
    setLoading(true);
    setShowConfirmation(false);

    try {
      console.log('🔒 Enviando bloqueio de agenda...');
      
      const { data, error } = await supabase.functions.invoke('bloqueio-agenda', {
        body: {
          medicoId,
          dataInicio,
          dataFim,
          motivo
        }
      });

      console.log('📡 Resposta da função:', { data, error });

      if (error) {
        console.error('❌ Erro na função:', error);
        throw new Error(error.message || 'Erro na comunicação com o servidor');
      }

      if (!data?.success) {
        console.error('❌ Resposta de erro:', data);
        throw new Error(data?.error || 'Erro desconhecido no servidor');
      }

      toast({
        title: "Agenda Bloqueada com Sucesso!",
        description: `${data.data.agendamentos_afetados} agendamento(s) serão cancelados.`,
      });

      // Limpar formulário
      setMedicoId('');
      setDataInicio('');
      setDataFim('');
      setMotivo('');

      console.log('✅ Bloqueio realizado:', data.data);

    } catch (error) {
      console.error('❌ Erro:', error);
      
      toast({
        title: "Erro ao Bloquear Agenda",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const medicoSelecionado = medicos.find(m => m.id === medicoId);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {onBack && (
        <Button 
          onClick={onBack}
          variant="outline" 
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Dashboard
        </Button>
      )}
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Bloqueio de Agenda Médica
          </CardTitle>
          <CardDescription>
            Bloqueie a agenda de um médico e notifique automaticamente os pacientes agendados via WhatsApp
          </CardDescription>
        </CardHeader>
      
      <CardContent>
        {loadingMedicos ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando médicos...</p>
          </div>
        ) : medicos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhum médico ativo encontrado</p>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleção do Médico */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Médico
            </Label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between"
                >
                  {medicoId
                    ? medicos.find((medico) => medico.id === medicoId)?.nome + " - " + medicos.find((medico) => medico.id === medicoId)?.especialidade
                    : "Selecione o médico..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 z-50" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                <Command>
                  <CommandInput placeholder="Pesquisar médico..." />
                  <CommandList>
                    <CommandEmpty>Nenhum médico encontrado.</CommandEmpty>
                    <CommandGroup>
                      {medicos.map((medico) => (
                        <CommandItem
                          key={medico.id}
                          value={`${medico.nome} ${medico.especialidade}`}
                          onSelect={() => {
                            setMedicoId(medico.id === medicoId ? "" : medico.id);
                            setOpenCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              medicoId === medico.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {medico.nome} - {medico.especialidade}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Período do Bloqueio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataInicio" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data de Início
              </Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dataFim" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data de Fim
              </Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                min={dataInicio || new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Motivo do Bloqueio
            </Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Médico em férias, emergência pessoal, etc."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              required
            />
          </div>

          {/* Preview da Ação */}
          {medicoSelecionado && dataInicio && dataFim && (
            <div className="bg-muted/50 p-4 rounded-lg border-l-4 border-l-destructive">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Ação que será executada:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Agenda de <strong>{medicoSelecionado.nome}</strong> será bloqueada</li>
                <li>• Período: <strong>{new Date(dataInicio).toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFim).toLocaleDateString('pt-BR')}</strong></li>
                <li>• Todos os agendamentos neste período serão <strong>cancelados automaticamente</strong></li>
                <li>• Pacientes serão <strong>notificados via WhatsApp</strong> sobre o cancelamento</li>
              </ul>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={loading || !medicoId || !dataInicio || !dataFim || !motivo}
            className="w-full"
            variant="destructive"
          >
            {loading ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Processando Bloqueio...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Bloquear Agenda e Notificar Pacientes
              </>
            )}
          </Button>
        </form>
        )}
      </CardContent>
    </Card>

    {/* Modal de Confirmação */}
    {showConfirmation && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Confirmar Bloqueio de Agenda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive font-medium mb-2">
                ⚠️ Esta ação NÃO pode ser desfeita!
              </p>
              <ul className="text-sm space-y-1">
                <li>• Médico: <strong>{medicoSelecionado?.nome}</strong></li>
                <li>• Período: <strong>{new Date(dataInicio).toLocaleDateString('pt-BR')}</strong> até <strong>{new Date(dataFim).toLocaleDateString('pt-BR')}</strong></li>
                <li>• Todos os agendamentos serão cancelados</li>
                <li>• Pacientes serão notificados via WhatsApp</li>
              </ul>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmation(false)}
                className="flex-1"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleBloqueioAgenda}
                className="flex-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Confirmar Bloqueio'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    </div>
  );
};