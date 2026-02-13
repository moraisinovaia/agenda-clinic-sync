import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import inovaiaLogo from '@/assets/inovaia-logo.jpeg';
import gtInovaLogo from '@/assets/gt-inova-logo-new.jpeg';

// Mapeamento local de logos por parceiro (fallback enquanto logo_url não está no Storage)
const LOCAL_PARTNER_LOGOS: Record<string, string> = {
  'INOVAIA': inovaiaLogo,
  'GT INOVA': gtInovaLogo,
};

interface PartnerBranding {
  partnerName: string;
  logoSrc: string;
  subtitle: string;
  isLoading: boolean;
}

const DEFAULT_BRANDING: PartnerBranding = {
  partnerName: 'INOVAIA',
  logoSrc: inovaiaLogo,
  subtitle: 'Sistema de Agendamentos Médicos',
  isLoading: true,
};

/**
 * Detecta o parceiro pelo hostname atual e retorna o branding correspondente.
 * Usado na tela de login (antes do usuário estar autenticado).
 * 
 * Lógica de detecção:
 * - "agenda.inovaia.com.br" → pattern "inovaia"
 * - "agenda.gtinova.com.br" → pattern "gtinova"
 * - Qualquer outro domínio → fallback INOVAIA
 */
/**
 * Checks if the current hostname is a generic domain (no partner-specific validation).
 * Generic domains: localhost, lovable.app, lovableproject.com, or any domain
 * that doesn't match any partner_branding domain_pattern.
 */
export function isGenericDomain(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname.includes('lovable.app') ||
    hostname.includes('lovableproject.com') ||
    hostname.includes('127.0.0.1')
  );
}

export function usePartnerBranding(): PartnerBranding {
  const [branding, setBranding] = useState<PartnerBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();

    supabase
      .from('partner_branding')
      .select('partner_name, domain_pattern, logo_url, subtitle')
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          setBranding({ ...DEFAULT_BRANDING, isLoading: false });
          return;
        }

        // Encontrar o parceiro cujo domain_pattern aparece no hostname
        const matches = data.filter(p => hostname.includes(p.domain_pattern));
        const matched = matches.sort((a, b) => b.domain_pattern.length - a.domain_pattern.length)[0];
        const partner = matched || data.find(p => p.partner_name === 'INOVAIA') || data[0];

        const logoSrc = partner.logo_url 
          || LOCAL_PARTNER_LOGOS[partner.partner_name] 
          || inovaiaLogo;

        setBranding({
          partnerName: partner.partner_name,
          logoSrc,
          subtitle: partner.subtitle || 'Sistema de Agendamentos Médicos',
          isLoading: false,
        });
      });
  }, []);

  return branding;
}
