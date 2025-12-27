import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Building2 } from 'lucide-react';

export default function NoClinicError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-destructive/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-4 rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Link Inválido</h2>
          <p className="text-muted-foreground mb-6">
            Nenhuma clínica foi especificada no link.
          </p>
          <div className="bg-muted/50 rounded-lg p-4 w-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              <span>Formato correto do link:</span>
            </div>
            <code className="text-xs bg-background px-2 py-1 rounded border block">
              seu-site.com/ID_DA_CLINICA
            </code>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Entre em contato com a clínica para obter o link correto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
