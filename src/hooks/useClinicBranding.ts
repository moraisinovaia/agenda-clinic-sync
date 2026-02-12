import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import inovaiaLogo from '@/assets/inovaia-logo.jpeg';
import gtInovaLogo from '@/assets/gt-inova-logo.jpeg';

const CLINICA_OLHOS_ID = 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a';

interface ClinicBranding {
  clinicName: string;
  clinicSubtitle: string;
  logoSrc: string;
  isLoading: boolean;
}

const DEFAULT_BRANDING: ClinicBranding = {
  clinicName: 'INOVAIA',
  clinicSubtitle: 'Sistema de Agendamentos Médicos',
  logoSrc: inovaiaLogo,
  isLoading: false,
};

// Local logo mappings for clinics with static assets
const LOCAL_LOGO_MAP: Record<string, string> = {
  [CLINICA_OLHOS_ID]: gtInovaLogo,
};

// Cache to avoid repeated queries
const brandingCache = new Map<string, { clinicName: string; logoSrc: string }>();

export function useClinicBranding(): ClinicBranding {
  const { profile } = useAuth();
  const [branding, setBranding] = useState<ClinicBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    const clienteId = profile?.cliente_id;
    if (!clienteId) {
      setBranding(DEFAULT_BRANDING);
      return;
    }

    // Check cache first
    const cached = brandingCache.get(clienteId);
    if (cached) {
      setBranding({ ...cached, clinicSubtitle: DEFAULT_BRANDING.clinicSubtitle, isLoading: false });
      return;
    }

    setBranding(prev => ({ ...prev, isLoading: true }));

    supabase
      .from('clientes')
      .select('nome, logo_url')
      .eq('id', clienteId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setBranding(DEFAULT_BRANDING);
          return;
        }

        // Resolve logo: local map > database logo_url > fallback
        const logoSrc = LOCAL_LOGO_MAP[clienteId] || data.logo_url || inovaiaLogo;
        const clinicName = data.nome || 'INOVAIA';

        const result = { clinicName, logoSrc };
        brandingCache.set(clienteId, result);

        setBranding({
          clinicName,
          clinicSubtitle: DEFAULT_BRANDING.clinicSubtitle,
          logoSrc,
          isLoading: false,
        });
      });
  }, [profile?.cliente_id]);

  return branding;
}
