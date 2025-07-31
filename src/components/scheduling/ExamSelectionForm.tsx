import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Atendimento } from "@/types/scheduling";
import { SelectedExam } from "@/types/multiple-appointments";

interface ExamSelectionFormProps {
  availableExams: Atendimento[];
  selectedExams: SelectedExam[];
  onExamChange: (exam: Atendimento, checked: boolean) => void;
}

export function ExamSelectionForm({ availableExams, selectedExams, onExamChange }: ExamSelectionFormProps) {
  if (availableExams.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Selecione um médico para ver os exames disponíveis
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Selecione os exames para agendar:</Label>
      
      <div className="grid gap-3 max-h-[300px] overflow-y-auto">
        {availableExams.map((exam) => {
          const isSelected = selectedExams.some(selected => selected.id === exam.id);
          
          return (
            <div key={exam.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
              <Checkbox
                id={`exam-${exam.id}`}
                checked={isSelected}
                onCheckedChange={(checked) => onExamChange(exam, !!checked)}
                className="mt-0.5"
              />
              
              <div className="space-y-1 flex-1 min-w-0">
                <Label 
                  htmlFor={`exam-${exam.id}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {exam.nome}
                </Label>
                
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="bg-secondary px-2 py-1 rounded">
                    {exam.tipo}
                  </span>
                  
                  {exam.valor_particular && (
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                      R$ {exam.valor_particular}
                    </span>
                  )}
                </div>
                
                {exam.observacoes && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {exam.observacoes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}