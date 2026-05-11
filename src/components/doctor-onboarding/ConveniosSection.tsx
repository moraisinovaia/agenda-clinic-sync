import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DoctorOnboardingFormData,
  ConvenioMedicoDraft,
  ConvenioMedicoTipoDraft,
  CONVENIO_TIPOS_DRAFT,
  CONVENIOS_PADRAO,
} from '@/types/doctor-onboarding';
import { CreditCard, Plus, Trash2, Info } from 'lucide-react';

interface ConveniosSectionProps {
  formData: DoctorOnboardingFormData;
  errors: Record<string, string>;
  addConvenio: () => void;
  updateConvenio: (index: number, patch: Partial<ConvenioMedicoDraft>) => void;
  removeConvenio: (index: number) => void;
}

export function ConveniosSection({
  formData,
  addConvenio,
  updateConvenio,
  removeConvenio,
}: ConveniosSectionProps) {
  const datalistId = 'convenios-padrao-suggestions';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Convênios</h3>
      </div>

      <div className="flex items-start gap-3 p-3 border border-dashed rounded-lg bg-muted/30">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Cadastre cada convênio com seu <strong>tipo</strong> (informativo, apenas consulta, bloqueado, etc.)
          e uma <strong>mensagem ao paciente</strong> opcional. A IA usará esses dados para responder no WhatsApp.
          Convênios sem nome serão ignorados ao salvar.
        </p>
      </div>

      <datalist id={datalistId}>
        {CONVENIOS_PADRAO.map(c => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="space-y-3">
        {formData.convenios_medico.length === 0 ? (
          <div className="text-xs text-muted-foreground italic p-3 text-center border rounded">
            Nenhum convênio adicionado.
          </div>
        ) : (
          formData.convenios_medico.map((row, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 border rounded-lg">
              <div className="col-span-12 md:col-span-3 space-y-1">
                <Label className="text-xs">Nome do convênio</Label>
                <Input
                  list={datalistId}
                  placeholder="Ex.: UNIMED NACIONAL"
                  value={row.convenio_nome}
                  onChange={(e) => updateConvenio(index, { convenio_nome: e.target.value })}
                />
              </div>
              <div className="col-span-12 md:col-span-3 space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={row.tipo}
                  onValueChange={(value: ConvenioMedicoTipoDraft) => updateConvenio(index, { tipo: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONVENIO_TIPOS_DRAFT.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 md:col-span-2 space-y-1">
                <Label className="text-xs">Observação</Label>
                <Input
                  placeholder="Interna"
                  value={row.observacao}
                  onChange={(e) => updateConvenio(index, { observacao: e.target.value })}
                />
              </div>
              <div className="col-span-11 md:col-span-3 space-y-1">
                <Label className="text-xs">Mensagem ao paciente</Label>
                <Textarea
                  placeholder="Ex.: Atendemos somente consultas."
                  value={row.mensagem_orientacao}
                  onChange={(e) => updateConvenio(index, { mensagem_orientacao: e.target.value })}
                  rows={1}
                />
              </div>
              <div className="col-span-1 flex justify-end pt-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeConvenio(index)}
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Button type="button" variant="outline" onClick={addConvenio} className="w-full">
        <Plus className="h-4 w-4 mr-2" /> Adicionar convênio
      </Button>
    </div>
  );
}
