import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Edit3, 
  Eye, 
  Save, 
  X, 
  Plus,
  MessageSquare,
  Clock,
  User,
  Calendar,
  MapPin,
  Phone,
  Copy
} from 'lucide-react';

interface NotificationTemplate {
  id: string;
  type: string;
  name: string;
  subject: string;
  message: string;
  variables: string[];
  active: boolean;
}

interface NotificationTemplateEditorProps {
  templates: NotificationTemplate[];
  onUpdateTemplate: (templateId: string, updates: Partial<NotificationTemplate>) => Promise<boolean>;
  onCreateTemplate?: (template: Omit<NotificationTemplate, 'id'>) => Promise<boolean>;
}

export const NotificationTemplateEditor: React.FC<NotificationTemplateEditorProps> = ({
  templates,
  onUpdateTemplate,
  onCreateTemplate
}) => {
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const { toast } = useToast();

  // Variáveis disponíveis para templates
  const availableVariables = [
    { key: 'paciente_nome', label: 'Nome do Paciente', icon: User },
    { key: 'data_consulta', label: 'Data da Consulta', icon: Calendar },
    { key: 'hora_consulta', label: 'Hora da Consulta', icon: Clock },
    { key: 'medico_nome', label: 'Nome do Médico', icon: User },
    { key: 'atendimento_nome', label: 'Tipo de Atendimento', icon: MessageSquare },
    { key: 'endereco', label: 'Endereço da Clínica', icon: MapPin },
    { key: 'telefone', label: 'Telefone da Clínica', icon: Phone },
    { key: 'paciente_celular', label: 'Celular do Paciente', icon: Phone }
  ];

  // Dados de exemplo para preview
  const previewData = {
    paciente_nome: 'João Silva',
    data_consulta: '15/02/2024',
    hora_consulta: '14:30',
    medico_nome: 'Dr. Maria Santos',
    atendimento_nome: 'Endoscopia Digestiva',
    endereco: 'Rua das Flores, 123 - Centro',
    telefone: '(11) 9999-9999',
    paciente_celular: '(11) 8888-8888'
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    const success = await onUpdateTemplate(editingTemplate.id, editingTemplate);
    if (success) {
      setEditingTemplate(null);
      setIsCreateMode(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!editingTemplate || !onCreateTemplate) return;

    const { id, ...templateData } = editingTemplate;
    const success = await onCreateTemplate(templateData);
    if (success) {
      setEditingTemplate(null);
      setIsCreateMode(false);
    }
  };

  const insertVariable = (variable: string) => {
    if (!editingTemplate) return;

    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = editingTemplate.message;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + `{${variable}}` + after;
      
      setEditingTemplate({ ...editingTemplate, message: newText });
      
      // Restaurar posição do cursor após inserção
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
      }, 0);
    }
  };

  const generatePreview = (template: NotificationTemplate): string => {
    let preview = template.message;
    Object.entries(previewData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{${key}}`, 'g'), value);
    });
    return preview;
  };

  const duplicateTemplate = (template: NotificationTemplate) => {
    const newTemplate: NotificationTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Cópia)`,
      active: false
    };
    setEditingTemplate(newTemplate);
    setIsCreateMode(true);
  };

  const typeLabels = {
    '48h': 'Lembrete 48h',
    '24h': 'Confirmação 24h',
    '2h': 'Lembrete 2h',
    '15min': 'Alerta Recepção',
    'confirmacao': 'Confirmação',
    'followup': 'Follow-up',
    'cancelamento': 'Cancelamento',
    'reagendamento': 'Reagendamento'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Templates de Mensagem</h3>
          <p className="text-sm text-muted-foreground">
            Personalize as mensagens enviadas automaticamente
          </p>
        </div>
        {onCreateTemplate && (
          <Button 
            onClick={() => {
              setEditingTemplate({
                id: `new-${Date.now()}`,
                type: '24h',
                name: 'Novo Template',
                subject: '',
                message: '',
                variables: [],
                active: false
              });
              setIsCreateMode(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {/* Lista de Templates */}
      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {typeLabels[template.type] || template.type}
                    </Badge>
                    <Badge variant={template.active ? "default" : "secondary"}>
                      {template.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => duplicateTemplate(template)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Assunto</Label>
                  <p className="text-sm">{template.subject}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Mensagem (prévia)</Label>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.message.substring(0, 100)}...
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.variables.map((variable) => (
                    <Badge key={variable} variant="outline" className="text-xs">
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editor Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreateMode ? 'Criar Template' : 'Editar Template'}
            </DialogTitle>
            <DialogDescription>
              Personalize o template de notificação
            </DialogDescription>
          </DialogHeader>

          {editingTemplate && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Configurações Básicas */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-name">Nome do Template</Label>
                    <Input
                      id="template-name"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate({
                        ...editingTemplate,
                        name: e.target.value
                      })}
                      placeholder="Ex: Lembrete 24h personalizado"
                    />
                  </div>

                  <div>
                    <Label htmlFor="template-type">Tipo</Label>
                    <Select
                      value={editingTemplate.type}
                      onValueChange={(value) => setEditingTemplate({
                        ...editingTemplate,
                        type: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(typeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="template-subject">Assunto</Label>
                    <Input
                      id="template-subject"
                      value={editingTemplate.subject}
                      onChange={(e) => setEditingTemplate({
                        ...editingTemplate,
                        subject: e.target.value
                      })}
                      placeholder="Assunto da notificação"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editingTemplate.active}
                      onCheckedChange={(checked) => setEditingTemplate({
                        ...editingTemplate,
                        active: checked
                      })}
                    />
                    <Label>Template ativo</Label>
                  </div>
                </div>

                {/* Variáveis Disponíveis */}
                <div className="space-y-4">
                  <div>
                    <Label>Variáveis Disponíveis</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Clique para inserir no texto
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {availableVariables.map((variable) => {
                        const Icon = variable.icon;
                        return (
                          <Button
                            key={variable.key}
                            variant="outline"
                            size="sm"
                            className="justify-start text-xs"
                            onClick={() => insertVariable(variable.key)}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {variable.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Editor de Mensagem */}
              <div>
                <Label htmlFor="message-textarea">Mensagem</Label>
                <Textarea
                  id="message-textarea"
                  value={editingTemplate.message}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    message: e.target.value
                  })}
                  placeholder="Digite sua mensagem aqui. Use {variavel} para inserir dados dinâmicos."
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use chaves para variáveis: {'{paciente_nome}'}, {'{data_consulta}'}, etc.
                </p>
              </div>

              {/* Preview */}
              <div>
                <Label>Preview</Label>
                <div className="mt-2 p-3 bg-muted rounded-lg border">
                  <div className="whitespace-pre-wrap text-sm">
                    {generatePreview(editingTemplate)}
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  onClick={isCreateMode ? handleCreateTemplate : handleSaveTemplate}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isCreateMode ? 'Criar' : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Como a mensagem aparecerá para o paciente
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm font-medium text-green-800 mb-2">
                  📱 WhatsApp - {previewData.paciente_nome}
                </div>
                <div className="whitespace-pre-wrap text-sm">
                  {generatePreview(previewTemplate)}
                </div>
                <div className="text-xs text-green-600 mt-2">
                  Enviado às {new Date().toLocaleTimeString('pt-BR')}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                ℹ️ Este é um exemplo usando dados fictícios. As variáveis serão substituídas pelos dados reais do agendamento.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};