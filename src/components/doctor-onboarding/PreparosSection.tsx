import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { DoctorOnboardingFormData, PreparoConfig } from '@/types/doctor-onboarding';
import { Plus, Trash2, FlaskConical, Clock, Pill, ShoppingBag, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PreparosSectionProps {
  formData: DoctorOnboardingFormData;
  errors: Record<string, string>;
  addPreparo: () => void;
  updatePreparo: (index: number, preparo: PreparoConfig) => void;
  removePreparo: (index: number) => void;
}

export function PreparosSection({ 
  formData, 
  errors, 
  addPreparo, 
  updatePreparo, 
  removePreparo 
}: PreparosSectionProps) {
  const handleFieldChange = (index: number, field: keyof PreparoConfig, value: unknown) => {
    const preparo = formData.preparos[index];
    updatePreparo(index, { ...preparo, [field]: value });
  };

  // Get exams from services
  const examesDisponiveis = formData.servicos
    .filter(s => s.tipo === 'exame')
    .map(s => s.nome)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Preparos de Exames</h3>
        </div>
        <Button onClick={addPreparo} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Preparo
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure os preparos necessários para cada exame. Essas informações serão enviadas 
        automaticamente aos pacientes no momento do agendamento.
      </p>

      {formData.preparos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">
              Nenhum preparo cadastrado.<br />
              {examesDisponiveis.length > 0 
                ? 'Adicione os preparos para os exames cadastrados.'
                : 'Primeiro cadastre serviços do tipo "Exame" na aba anterior.'}
            </p>
            {examesDisponiveis.length > 0 && (
              <Button onClick={addPreparo} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Preparo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {formData.preparos.map((preparo, index) => (
            <AccordionItem key={index} value={`preparo-${index}`} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <FlaskConical className="h-4 w-4" />
                  <span className="font-medium">
                    {preparo.nome || `Preparo ${index + 1}`}
                  </span>
                  {preparo.exame && (
                    <Badge variant="outline">{preparo.exame}</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nome do Preparo</Label>
                      <Input
                        placeholder="Ex: Preparo Colonoscopia"
                        value={preparo.nome}
                        onChange={(e) => handleFieldChange(index, 'nome', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Exame Relacionado <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={preparo.exame}
                        onValueChange={(value) => handleFieldChange(index, 'exame', value)}
                      >
                        <SelectTrigger className={errors[`preparo_${index}_exame`] ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Selecione o exame" />
                        </SelectTrigger>
                        <SelectContent>
                          {examesDisponiveis.map((exame) => (
                            <SelectItem key={exame} value={exame}>
                              {exame}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors[`preparo_${index}_exame`] && (
                        <p className="text-sm text-destructive">{errors[`preparo_${index}_exame`]}</p>
                      )}
                    </div>
                  </div>

                  {/* Fasting and Medication */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Jejum e Medicação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Horas de Jejum</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={preparo.jejum_horas ?? ''}
                            onChange={(e) => handleFieldChange(index, 'jejum_horas', e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dias de Suspensão (medicação)</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="0"
                            value={preparo.dias_suspensao ?? ''}
                            onChange={(e) => handleFieldChange(index, 'dias_suspensao', e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          Medicação a Suspender
                        </Label>
                        <Textarea
                          placeholder="Ex: Suspender anticoagulantes 7 dias antes. Suspender AAS 5 dias antes."
                          value={preparo.medicacao_suspender}
                          onChange={(e) => handleFieldChange(index, 'medicacao_suspender', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Restrições Alimentares</Label>
                        <Textarea
                          placeholder="Ex: Dieta líquida 24h antes. Evitar alimentos com corantes..."
                          value={preparo.restricoes_alimentares}
                          onChange={(e) => handleFieldChange(index, 'restricoes_alimentares', e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Items to Bring */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      Itens a Levar
                    </Label>
                    <Textarea
                      placeholder="Ex: Exames anteriores, documento com foto, cartão do convênio..."
                      value={preparo.itens_levar}
                      onChange={(e) => handleFieldChange(index, 'itens_levar', e.target.value)}
                    />
                  </div>

                  {/* Values */}
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Valores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Valor Particular (R$)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0,00"
                            value={preparo.valor_particular ?? ''}
                            onChange={(e) => handleFieldChange(index, 'valor_particular', e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor Convênio (R$)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0,00"
                            value={preparo.valor_convenio ?? ''}
                            onChange={(e) => handleFieldChange(index, 'valor_convenio', e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Formas de Pagamento</Label>
                          <Input
                            placeholder="Cartão, PIX, Dinheiro"
                            value={preparo.forma_pagamento}
                            onChange={(e) => handleFieldChange(index, 'forma_pagamento', e.target.value)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Special Observations */}
                  <div className="space-y-2">
                    <Label>Observações Especiais</Label>
                    <Textarea
                      placeholder="Outras informações importantes sobre o preparo..."
                      value={preparo.observacoes_especiais}
                      onChange={(e) => handleFieldChange(index, 'observacoes_especiais', e.target.value)}
                    />
                  </div>

                  {/* Delete Button */}
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removePreparo(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover Preparo
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
