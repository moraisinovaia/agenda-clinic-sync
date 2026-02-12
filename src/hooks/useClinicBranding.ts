import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerBranding } from '@/hooks/usePartnerBranding';

interface ClinicBranding {
  clinicName: string;
  clinicSubtitle: string;
  logoSrc: string;
  isLoading: boolean;
}

// Cache to avoid repeated queries
const brandingCache = new Map<string, { clinicName: string; logoSrc: string }>();

/**
 * Hook que retorna o branding da clínica do usuário logado.
 * Prioridade de logo: clientes.logo_url do banco → logo do parceiro (fallback)
 */
export function useClinicBranding(): ClinicBranding {
  const { profile } = useAuth();
  const { partnerName, logoSrc: partnerLogoSrc, subtitle } = usePartnerBranding();
  
  const defaultBranding: ClinicBranding = {
    clinicName: partnerName,
    clinicSubtitle: subtitle,
    logoSrc: partnerLogoSrc,
    isLoading: false,
  };

  const [branding, setBranding] = useState<ClinicBranding>({ ...defaultBranding, isLoading: true });

  useEffect(() => {
    const clienteId = profile?.cliente_id;
    if (!clienteId) {
      setBranding(defaultBranding);
      return;
    }

    // Check cache first
    const cached = brandingCache.get(clienteId);
    if (cached) {
      setBranding({ ...cached, clinicSubtitle: subtitle, isLoading: false });
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
          setBranding(defaultBranding);
          return;
        }

        // Prioridade: logo_url do banco → logo do parceiro (fallback)
        const logoSrc = data.logo_url || partnerLogoSrc;
        const clinicName = data.nome || partnerName;

        const result = { clinicName, logoSrc };
        brandingCache.set(clienteId, result);

        setBranding({
          clinicName,
          clinicSubtitle: subtitle,
          logoSrc,
          isLoading: false,
        });
      });
  }, [profile?.cliente_id, partnerName, partnerLogoSrc, subtitle]);

  return branding;
}
