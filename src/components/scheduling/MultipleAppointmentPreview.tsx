import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Stethoscope } from "lucide-react";
import { SelectedExam } from "@/types/multiple-appointments";
import { Doctor } from "@/types/scheduling";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MultipleAppointmentPreviewProps {
  selectedExams: SelectedExam[];
  selectedDoctor: Doctor | null;
  patientName: string;
  appointmentDate: string;
  appointmentTime: string;
}

export function MultipleAppointmentPreview({ 
  selectedExams, 
  selectedDoctor, 
  patientName,
  appointmentDate,
  appointmentTime
}: MultipleAppointmentPreviewProps) {
  if (selectedExams.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            Nenhum exame selecionado
          </div>
        </CardContent>
      </Card>
    );
  }

  const formattedDate = appointmentDate ? 
    format(new Date(appointmentDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 
    '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4" />
          Resumo do Agendamento Múltiplo
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Informações do Paciente e Médico */}
        <div className="space-y-2">
          {patientName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{patientName}</span>
            </div>
          )}
          
          {selectedDoctor && (
            <div className="flex items-center gap-2 text-sm">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <span>{selectedDoctor.nome} - {selectedDoctor.especialidade}</span>
            </div>
          )}
          
          {appointmentDate && appointmentTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formattedDate} às {appointmentTime}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Exames Selecionados */}
        <div className="space-y-3">
          <div className="text-sm font-medium">
            Exames que serão agendados ({selectedExams.length}):
          </div>
          
          <div className="space-y-2">
            {selectedExams.map((exam, index) => (
              <div key={exam.id} className="flex items-center justify-between p-2 bg-secondary/30 rounded">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {index + 1}
                  </Badge>
                  <span className="text-sm font-medium">{exam.nome}</span>
                </div>
                
                <Badge variant="secondary" className="text-xs">
                  {exam.tipo}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Observação */}
        <div className="bg-primary/5 p-3 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Importante:</strong> Todos os exames serão agendados para o mesmo horário. 
            O sistema criará {selectedExams.length} agendamentos separados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}