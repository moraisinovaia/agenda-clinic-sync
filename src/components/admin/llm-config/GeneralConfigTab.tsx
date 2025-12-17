import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import { LLMClinicConfig } from '@/hooks/useLLMConfig';

interface GeneralConfigTabProps {
  config: LLMClinicConfig | null;
  saving: boolean;
  onSave: (data: Partial<LLMClinicConfig>) => Promise<boolean>;
}

export function GeneralConfigTab({ config, saving, onSave }: GeneralConfigTabProps) {
  const [formData, setFormData] = useState({
    nome_clinica: '',
    telefone: '',
    whatsapp: '',
    endereco: '',
    data_minima_agendamento: '',
    mensagem_bloqueio_padrao: '',
    dias_busca_inicial: 14,
    dias_busca_expandida: 45
  });

  useEffect(() => {
    if (config) {
      setFormData({
        nome_clinica: config.nome_clinica || '',
        telefone: config.telefone || '',
        whatsapp: config.whatsapp || '',
        endereco: config.endereco || '',
        data_minima_agendamento: config.data_minima_agendamento || '',
        mensagem_bloqueio_padrao: config.mensagem_bloqueio_padrao || '',
        dias_busca_inicial: config.dias_busca_inicial || 14,
        dias_busca_expandida: config.dias_busca_expandida || 45
      });
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração Geral da LLM API</CardTitle>
        <CardDescription>
          Configure as informações gerais que serão usadas pelo agente LLM (N8N/WhatsApp)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome_clinica">Nome da Clínica</Label>
              <Input
                id="nome_clinica"
                value={formData.nome_clinica}
                onChange={e => setFormData(prev => ({ ...prev, nome_clinica: e.target.value }))}
                placeholder="Ex: IPADO - Clínica de Especialidades"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone de Contato</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={e => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="Ex: (87) 3866-4050"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp}
                onChange={e => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="Ex: (87) 3866-4050"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="data_minima_agendamento">Data Mínima para Agendamentos</Label>
              <Input
                id="data_minima_agendamento"
                type="date"
                value={formData.data_minima_agendamento}
                onChange={e => setFormData(prev => ({ ...prev, data_minima_agendamento: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Agendamentos só serão permitidos a partir desta data
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dias_busca_inicial">Dias de Busca Inicial</Label>
              <Input
                id="dias_busca_inicial"
                type="number"
                min={1}
                max={90}
                value={formData.dias_busca_inicial}
                onChange={e => setFormData(prev => ({ ...prev, dias_busca_inicial: parseInt(e.target.value) || 14 }))}
              />
              <p className="text-xs text-muted-foreground">
                Quantos dias buscar inicialmente por vagas
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dias_busca_expandida">Dias de Busca Expandida</Label>
              <Input
                id="dias_busca_expandida"
                type="number"
                min={1}
                max={180}
                value={formData.dias_busca_expandida}
                onChange={e => setFormData(prev => ({ ...prev, dias_busca_expandida: parseInt(e.target.value) || 45 }))}
              />
              <p className="text-xs text-muted-foreground">
                Quantos dias buscar se não encontrar vagas na busca inicial
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={e => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
              placeholder="Ex: Rua Exemplo, 123 - Centro"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="mensagem_bloqueio_padrao">Mensagem de Bloqueio Padrão</Label>
            <Textarea
              id="mensagem_bloqueio_padrao"
              value={formData.mensagem_bloqueio_padrao}
              onChange={e => setFormData(prev => ({ ...prev, mensagem_bloqueio_padrao: e.target.value }))}
              placeholder="Mensagem exibida quando não há vagas disponíveis"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Esta mensagem será usada quando a agenda estiver bloqueada ou sem vagas
            </p>
          </div>
          
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
