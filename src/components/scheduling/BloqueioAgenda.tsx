import React, { useState } from 'react';
import { Calendar, AlertTriangle, Clock, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Medico {
  id: string;
  nome: string;
  especialidade: string;
}

interface BloqueioAgendaProps {
  medicos: Medico[];
}

export const BloqueioAgenda: React.FC<BloqueioAgendaProps> = ({ medicos }) => {
  const [loading, setLoading] = useState(false);
  const [medicoId, setMedicoId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const { toast } = useToast();

  const handleBloqueioAgenda = async (e: React.FormEvent) => {
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

    setLoading(true);

    try {
      console.log('🔒 Iniciando bloqueio de agenda...');
      
      const { data, error } = await supabase.functions.invoke('bloqueio-agenda', {
        body: {
          medicoId,
          dataInicio,
          dataFim,
          motivo,
          criadoPor: 'recepcionista'
        }
      });

      if (error) throw error;

      const resultado = data.data;
      
      toast({
        title: "Agenda Bloqueada com Sucesso!",
        description: `${resultado.agendamentos_cancelados} agendamento(s) cancelado(s) e pacientes notificados.`,
      });

      // Limpar formulário
      setMedicoId('');
      setDataInicio('');
      setDataFim('');
      setMotivo('');

      console.log('✅ Bloqueio realizado:', resultado);

    } catch (error) {
      console.error('❌ Erro ao bloquear agenda:', error);
      toast({
        title: "Erro",
        description: "Erro ao bloquear agenda. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const medicoSelecionado = medicos.find(m => m.id === medicoId);

  return (
    <Card className="w-full max-w-2xl">
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
        <form onSubmit={handleBloqueioAgenda} className="space-y-6">
          {/* Seleção do Médico */}
          <div className="space-y-2">
            <Label htmlFor="medico" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Médico
            </Label>
            <Select value={medicoId} onValueChange={setMedicoId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o médico" />
              </SelectTrigger>
              <SelectContent>
                {medicos.map((medico) => (
                  <SelectItem key={medico.id} value={medico.id}>
                    {medico.nome} - {medico.especialidade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      </CardContent>
    </Card>
  );
};