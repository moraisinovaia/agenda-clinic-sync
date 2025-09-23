import React from 'react';
import { Button } from '@/components/ui/button';
import { Building2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function OnboardingButton() {
  const navigate = useNavigate();

  return (
    <div className="text-center space-y-4 p-6 border border-dashed border-primary/20 rounded-lg bg-primary/5">
      <Building2 className="h-12 w-12 text-primary mx-auto" />
      <div>
        <h3 className="text-lg font-semibold mb-2">Criar Nova Clínica</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure uma nova clínica com médicos, atendimentos e configurações em poucos minutos.
        </p>
      </div>
      
      <Button 
        onClick={() => navigate('/onboarding')}
        className="w-full"
        size="lg"
      >
        <Plus className="h-4 w-4 mr-2" />
        Começar Setup
      </Button>
    </div>
  );
}