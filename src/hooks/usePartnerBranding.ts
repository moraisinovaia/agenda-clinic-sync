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
 * Checks if the current hostname is a generic domain (no partner-specific validation).
 */
export function isGenericDomain(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  const generic = (
    hostname === 'localhost' ||
    hostname.includes('lovable.app') ||
    hostname.includes('lovableproject.com') ||
    hostname.includes('127.0.0.1')
  );
  console.log(`🌐 isGenericDomain: hostname="${hostname}" → ${generic}`);
  return generic;
}

/**
 * Detects the partner by hostname via direct DB query.
 * Use this in imperative flows (e.g., handleLogin) to avoid race conditions with React state.
 */
export async function detectPartnerByHostname(): Promise<string> {
  const hostname = window.location.hostname.toLowerCase();
  console.log(`🔍 detectPartnerByHostname: hostname="${hostname}"`);
  
  const { data, error } = await supabase
    .from('partner_branding')
    .select('partner_name, domain_pattern');
  
  if (error || !data || data.length === 0) {
    console.log('⚠️ detectPartnerByHostname: sem dados, fallback INOVAIA');
    return 'INOVAIA';
  }

  const matches = data.filter(p => hostname.includes(p.domain_pattern));
  console.log(`🔍 detectPartnerByHostname: patterns testados:`, data.map(p => `"${p.domain_pattern}"`).join(', '));
  console.log(`🔍 detectPartnerByHostname: matches encontrados:`, matches.map(p => `${p.partner_name}(${p.domain_pattern})`).join(', '));
  
  const matched = matches.sort((a, b) => b.domain_pattern.length - a.domain_pattern.length)[0];
  const result = matched?.partner_name || 'INOVAIA';
  console.log(`✅ detectPartnerByHostname: resultado="${result}"`);
  return result;
}

export function usePartnerBranding(): PartnerBranding {
  const [branding, setBranding] = useState<PartnerBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    console.log(`🎨 usePartnerBranding: iniciando detecção para hostname="${hostname}"`);

    supabase
      .from('partner_branding')
      .select('partner_name, domain_pattern, logo_url, subtitle')
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          console.log('⚠️ usePartnerBranding: sem dados do banco, usando default INOVAIA');
          setBranding({ ...DEFAULT_BRANDING, isLoading: false });
          return;
        }

        const matches = data.filter(p => hostname.includes(p.domain_pattern));
        const matched = matches.sort((a, b) => b.domain_pattern.length - a.domain_pattern.length)[0];
        const partner = matched || data.find(p => p.partner_name === 'INOVAIA') || data[0];

        console.log(`🎨 usePartnerBranding: matches=[${matches.map(p => p.partner_name).join(',')}], escolhido="${partner.partner_name}"`);

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
