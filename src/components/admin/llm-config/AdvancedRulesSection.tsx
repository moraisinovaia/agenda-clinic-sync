import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Ban, Package, Timer, Plus, X } from 'lucide-react';

interface AdvancedRulesSectionProps {
  config: any;
  atendimentos: any[];
  conveniosDisponiveis: string[];
  onChange: (config: any) => void;
}

// ========== HELPER FUNCTIONS FOR DATA NORMALIZATION ==========

/**
 * Extracts the blocked convenios from restricoes_convenio value
 * Supports both formats:
 * - Legacy: { nao_permite: string[], mensagem?: string }
 * - Simple: string[]
 */
function getBlockedConvenios(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object' && 'nao_permite' in value) {
    const obj = value as { nao_permite: unknown };
    if (Array.isArray(obj.nao_permite)) {
      return obj.nao_permite;
    }
  }
  return [];
}

/**
 * Extracts the message from restricoes_convenio value if present
 */
function getRestricaoMensagem(value: unknown): string | undefined {
  if (value && typeof value === 'object' && 'mensagem' in value) {
    return (value as { mensagem?: string }).mensagem;
  }
  return undefined;
}

/**
 * Parses pacote_obrigatorio from database format to UI format
 * Database format: { [convenio]: { [servico]: string[], mensagem?: string } }
 * Returns array of { convenio, servico, exige, mensagem }
 */
function parsePacotesObrigatorios(pacotes: unknown): Array<{
  convenio: string;
  servico: string;
  exige: string;
  mensagem?: string;
}> {
  if (!pacotes || typeof pacotes !== 'object') return [];
  
  const result: Array<{ convenio: string; servico: string; exige: string; mensagem?: string }> = [];
  
  for (const [convenio, value] of Object.entries(pacotes)) {
    if (!value || typeof value !== 'object') continue;
    
    const pacoteValue = value as Record<string, unknown>;
    
    // Check if it's the simple UI format: { servico, exige, mensagem }
    if ('servico' in pacoteValue && 'exige' in pacoteValue) {
      result.push({
        convenio,
        servico: String(pacoteValue.servico || ''),
        exige: String(pacoteValue.exige || ''),
        mensagem: pacoteValue.mensagem ? String(pacoteValue.mensagem) : undefined
      });
      continue;
    }
    
    // Database format: { [servico]: string[], mensagem?: string }
    const mensagem = typeof pacoteValue.mensagem === 'string' ? pacoteValue.mensagem : undefined;
    
    for (const [servico, exigeValue] of Object.entries(pacoteValue)) {
      if (servico === 'mensagem') continue;
      
      if (Array.isArray(exigeValue)) {
        result.push({
          convenio,
          servico,
          exige: exigeValue.join(', '),
          mensagem
        });
      }
    }
  }
  
  return result;
}

/**
 * Parses intervalo key to get the "de" and "para" service names
 * Supports both formats: "ECG->TESTE" and "ECG_para_TESTE"
 */
function parseIntervaloKey(key: string): { de: string; para: string } {
  if (key.includes('->')) {
    const [de, para] = key.split('->');
    return { de: de || '', para: para || '' };
  }
  if (key.includes('_para_')) {
    const [de, para] = key.split('_para_');
    return { 
      de: (de || '').replace(/_/g, ' '), 
      para: (para || '').replace(/_/g, ' ') 
    };
  }
  return { de: key, para: '' };
}

/**
 * Safely gets restricoes_intervalo as a record
 */
function getRestricoesIntervalo(config: any): Record<string, { dias_minimo: number; mensagem?: string }> {
  const raw = config?.restricoes_intervalo;
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, { dias_minimo: number; mensagem?: string }>;
}

export function AdvancedRulesSection({ 
  config, 
  atendimentos, 
  conveniosDisponiveis,
  onChange 
}: AdvancedRulesSectionProps) {
  // Defensive check - ensure convenios is always an array
  const safeConvenios = Array.isArray(conveniosDisponiveis) ? conveniosDisponiveis : [];
  
  // States for new restriction forms
  const [newRestricaoServico, setNewRestricaoServico] = useState('');
  const [selectedConvenios, setSelectedConvenios] = useState<string[]>([]);
  
  const [newPacoteConvenio, setNewPacoteConvenio] = useState('');
  const [newPacoteServico, setNewPacoteServico] = useState('');
  const [newPacoteExige, setNewPacoteExige] = useState('');
  const [newPacoteMensagem, setNewPacoteMensagem] = useState('');
  
  const [newIntervaloDe, setNewIntervaloDe] = useState('');
  const [newIntervaloPara, setNewIntervaloPara] = useState('');
  const [newIntervaloDias, setNewIntervaloDias] = useState(15);
  const [newIntervaloMensagem, setNewIntervaloMensagem] = useState('');

  // Get all service names (from config and atendimentos)
  const allServiceNames = [
    ...Object.keys(config?.servicos || {}),
    ...atendimentos.map(a => a.nome)
  ].filter((v, i, a) => a.indexOf(v) === i);

  // ========== RESTRIÇÕES DE CONVÊNIO ==========
  const restricoesConvenioRaw = config?.restricoes_convenio || {};
  const restricoesConvenio = typeof restricoesConvenioRaw === 'object' ? restricoesConvenioRaw : {};
  
  const handleToggleConvenio = (convenio: string) => {
    setSelectedConvenios(prev => 
      prev.includes(convenio) 
        ? prev.filter(c => c !== convenio)
        : [...prev, convenio]
    );
  };

  const handleAddRestricaoConvenio = () => {
    if (!newRestricaoServico || selectedConvenios.length === 0) return;
    
    // Get existing data for this service
    const existingValue = restricoesConvenio[newRestricaoServico];
    const existingConvenios = getBlockedConvenios(existingValue);
    const existingMensagem = getRestricaoMensagem(existingValue);
    
    // Merge with new convenios
    const allConvenios = [
      ...existingConvenios,
      ...selectedConvenios.filter(c => !existingConvenios.includes(c))
    ];
    
    // Save in database format (with nao_permite)
    const newRestricoes = {
      ...restricoesConvenio,
      [newRestricaoServico]: {
        nao_permite: allConvenios,
        ...(existingMensagem ? { mensagem: existingMensagem } : {})
      }
    };
    
    onChange({ ...config, restricoes_convenio: newRestricoes });
    setNewRestricaoServico('');
    setSelectedConvenios([]);
  };

  const handleRemoveRestricaoConvenio = (servico: string) => {
    const newRestricoes = { ...restricoesConvenio };
    delete newRestricoes[servico];
    onChange({ ...config, restricoes_convenio: Object.keys(newRestricoes).length > 0 ? newRestricoes : undefined });
  };

  // ========== PACOTES OBRIGATÓRIOS ==========
  const pacotesObrigatoriosRaw = config?.pacote_obrigatorio || {};
  const pacotesList = parsePacotesObrigatorios(pacotesObrigatoriosRaw);

  const handleAddPacoteObrigatorio = () => {
    if (!newPacoteConvenio || !newPacoteServico || !newPacoteExige) return;
    
    // Save in database format
    const existingPacotes = typeof pacotesObrigatoriosRaw === 'object' ? { ...pacotesObrigatoriosRaw } : {};
    
    existingPacotes[newPacoteConvenio] = {
      [newPacoteServico]: [newPacoteExige],
      mensagem: newPacoteMensagem || `${newPacoteServico} para ${newPacoteConvenio} exige ${newPacoteExige}`
    };
    
    onChange({ ...config, pacote_obrigatorio: existingPacotes });
    setNewPacoteConvenio('');
    setNewPacoteServico('');
    setNewPacoteExige('');
    setNewPacoteMensagem('');
  };

  const handleRemovePacoteObrigatorio = (convenio: string) => {
    const newPacotes = typeof pacotesObrigatoriosRaw === 'object' ? { ...pacotesObrigatoriosRaw } : {};
    delete newPacotes[convenio];
    onChange({ ...config, pacote_obrigatorio: Object.keys(newPacotes).length > 0 ? newPacotes : undefined });
  };

  // ========== INTERVALOS MÍNIMOS ==========
  const restricoesIntervalo = getRestricoesIntervalo(config);

  const handleAddRestricaoIntervalo = () => {
    if (!newIntervaloDe || !newIntervaloPara || newIntervaloDe === newIntervaloPara) return;
    
    // Use database-compatible format with _para_
    const encodeKey = (s: string) => s.toUpperCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const key = `${encodeKey(newIntervaloDe)}_para_${encodeKey(newIntervaloPara)}`;
    
    const newIntervalos = {
      ...restricoesIntervalo,
      [key]: {
        dias_minimo: newIntervaloDias,
        mensagem: newIntervaloMensagem || `Intervalo mínimo de ${newIntervaloDias} dias entre ${newIntervaloDe} e ${newIntervaloPara}`
      }
    };
    
    onChange({ ...config, restricoes_intervalo: newIntervalos });
    setNewIntervaloDe('');
    setNewIntervaloPara('');
    setNewIntervaloDias(15);
    setNewIntervaloMensagem('');
  };

  const handleRemoveRestricaoIntervalo = (key: string) => {
    const newIntervalos = { ...restricoesIntervalo };
    delete newIntervalos[key];
    onChange({ ...config, restricoes_intervalo: Object.keys(newIntervalos).length > 0 ? newIntervalos : undefined });
  };

  return (
    <div className="space-y-6">
      {/* ========== RESTRIÇÕES DE CONVÊNIO POR SERVIÇO ========== */}
      <div className="space-y-4 p-4 bg-red-500/5 rounded-lg border border-red-500/20">
        <Label className="text-lg font-medium flex items-center gap-2 text-red-700 dark:text-red-400">
          <Ban className="h-5 w-5" />
          Restrições de Convênio por Serviço
        </Label>
        <p className="text-sm text-muted-foreground">
          Configure quais convênios NÃO são aceitos para determinados serviços.
        </p>

        {/* Lista de restrições existentes */}
        <div className="space-y-2">
          {Object.entries(restricoesConvenio).map(([servico, value]) => {
            const convenios = getBlockedConvenios(value);
            const mensagem = getRestricaoMensagem(value);
            
            if (convenios.length === 0) return null;
            
            return (
              <Card key={servico} className="p-3 bg-background">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-red-700 dark:text-red-400">{servico}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Não aceita: 
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {convenios.map((conv: string) => (
                        <Badge key={conv} variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30 text-xs">
                          {conv}
                        </Badge>
                      ))}
                    </div>
                    {mensagem && (
                      <p className="text-xs text-muted-foreground italic mt-2">{mensagem}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveRestricaoConvenio(servico)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Formulário para nova restrição */}
        <Card className="p-4 space-y-3 border-dashed">
          <div>
            <Label className="text-sm">Serviço</Label>
            <Select value={newRestricaoServico} onValueChange={setNewRestricaoServico}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar serviço" />
              </SelectTrigger>
              <SelectContent>
                {allServiceNames.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm">Convênios que NÃO são aceitos</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-40 overflow-y-auto p-2 border rounded-md">
              {safeConvenios.map(conv => (
                <div key={conv} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`conv-${conv}`}
                    checked={selectedConvenios.includes(conv)}
                    onCheckedChange={() => handleToggleConvenio(conv)}
                  />
                  <label htmlFor={`conv-${conv}`} className="text-sm cursor-pointer">
                    {conv}
                  </label>
                </div>
              ))}
              {safeConvenios.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Nenhum convênio cadastrado para este médico.
                </p>
              )}
            </div>
          </div>

          <Button 
            onClick={handleAddRestricaoConvenio} 
            disabled={!newRestricaoServico || selectedConvenios.length === 0}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Restrição
          </Button>
        </Card>
      </div>

      {/* ========== PACOTES OBRIGATÓRIOS POR CONVÊNIO ========== */}
      <div className="space-y-4 p-4 bg-purple-500/5 rounded-lg border border-purple-500/20">
        <Label className="text-lg font-medium flex items-center gap-2 text-purple-700 dark:text-purple-400">
          <Package className="h-5 w-5" />
          Pacotes Obrigatórios por Convênio
        </Label>
        <p className="text-sm text-muted-foreground">
          Configure quando um serviço exige outro serviço junto para determinado convênio.
        </p>

        {/* Lista de pacotes existentes */}
        <div className="space-y-2">
          {pacotesList.map((pacote, idx) => (
            <Card key={`${pacote.convenio}-${idx}`} className="p-3 bg-background">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium text-purple-700 dark:text-purple-400">{pacote.convenio}</p>
                  <p className="text-sm mt-1">
                    <span className="font-medium">{pacote.servico}</span>
                    <span className="text-muted-foreground"> → exige </span>
                    <span className="font-medium">{pacote.exige}</span>
                  </p>
                  {pacote.mensagem && (
                    <p className="text-xs text-muted-foreground italic mt-1">{pacote.mensagem}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemovePacoteObrigatorio(pacote.convenio)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Formulário para novo pacote */}
        <Card className="p-4 space-y-3 border-dashed">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm">Convênio</Label>
              <Select value={newPacoteConvenio} onValueChange={setNewPacoteConvenio}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {safeConvenios.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Quando agendar</Label>
              <Select value={newPacoteServico} onValueChange={setNewPacoteServico}>
                <SelectTrigger>
                  <SelectValue placeholder="Serviço" />
                </SelectTrigger>
                <SelectContent>
                  {allServiceNames.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Exigir junto</Label>
              <Select value={newPacoteExige} onValueChange={setNewPacoteExige}>
                <SelectTrigger>
                  <SelectValue placeholder="Serviço" />
                </SelectTrigger>
                <SelectContent>
                  {allServiceNames.filter(s => s !== newPacoteServico).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-sm">Mensagem (opcional)</Label>
            <Input
              placeholder="Ex: Consulta UNIMED sempre acompanhada de ECG"
              value={newPacoteMensagem}
              onChange={e => setNewPacoteMensagem(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleAddPacoteObrigatorio} 
            disabled={!newPacoteConvenio || !newPacoteServico || !newPacoteExige}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Pacote Obrigatório
          </Button>
        </Card>
      </div>

      {/* ========== INTERVALOS MÍNIMOS ENTRE EXAMES ========== */}
      <div className="space-y-4 p-4 bg-orange-500/5 rounded-lg border border-orange-500/20">
        <Label className="text-lg font-medium flex items-center gap-2 text-orange-700 dark:text-orange-400">
          <Timer className="h-5 w-5" />
          Intervalos Mínimos Entre Exames
        </Label>
        <p className="text-sm text-muted-foreground">
          Configure o intervalo mínimo de dias necessário entre dois exames.
        </p>

        {/* Lista de intervalos existentes */}
        <div className="space-y-2">
          {Object.entries(restricoesIntervalo).map(([key, intervalo]) => {
            const { de, para } = parseIntervaloKey(key);
            if (!de || !para) return null;
            
            return (
              <Card key={key} className="p-3 bg-background">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{de}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline">{para}</Badge>
                      <Badge className="bg-orange-500/20 text-orange-700 border-orange-500/30">
                        Mín. {intervalo?.dias_minimo || 0} dias
                      </Badge>
                    </div>
                    {intervalo?.mensagem && (
                      <p className="text-xs text-muted-foreground italic mt-1">{intervalo.mensagem}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveRestricaoIntervalo(key)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Formulário para novo intervalo */}
        <Card className="p-4 space-y-3 border-dashed">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm">De (exame)</Label>
              <Select value={newIntervaloDe} onValueChange={setNewIntervaloDe}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {allServiceNames.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Para (exame)</Label>
              <Select value={newIntervaloPara} onValueChange={setNewIntervaloPara}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {allServiceNames.filter(s => s !== newIntervaloDe).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Intervalo (dias)</Label>
              <Input
                type="number"
                value={newIntervaloDias}
                onChange={e => setNewIntervaloDias(parseInt(e.target.value) || 15)}
                min={1}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Mensagem (opcional)</Label>
            <Input
              placeholder="Ex: Intervalo mínimo de 15 dias entre ECG e Teste Ergométrico"
              value={newIntervaloMensagem}
              onChange={e => setNewIntervaloMensagem(e.target.value)}
            />
          </div>

          <Button 
            onClick={handleAddRestricaoIntervalo} 
            disabled={!newIntervaloDe || !newIntervaloPara || newIntervaloDe === newIntervaloPara}
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Intervalo
          </Button>
        </Card>
      </div>
    </div>
  );
}
