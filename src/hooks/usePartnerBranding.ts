import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import inovaiaLogo from '@/assets/inovaia-logo.jpeg';
import gtInovaLogo from '@/assets/gt-inova-logo-new.jpeg';

type PartnerName = 'INOVAIA' | 'GT INOVA';

interface PartnerBranding {
  partnerName: PartnerName;
  logoSrc: string;
  subtitle: string;
  isLoading: boolean;
}

interface PartnerBrandingRow {
  partner_name: string;
  domain_pattern: string;
  logo_url: string | null;
  subtitle: string | null;
  primary_color?: string | null;
}

const LOCAL_PARTNER_LOGOS: Record<PartnerName, string> = {
  INOVAIA: inovaiaLogo,
  'GT INOVA': gtInovaLogo,
};

const DEFAULT_PARTNER_NAME: PartnerName = 'INOVAIA';

const DEFAULT_BRANDING: Record<PartnerName, Omit<PartnerBranding, 'isLoading'>> = {
  INOVAIA: {
    partnerName: 'INOVAIA',
    logoSrc: inovaiaLogo,
    subtitle: 'Sistema de Agendamentos Médicos',
  },
  'GT INOVA': {
    partnerName: 'GT INOVA',
    logoSrc: gtInovaLogo,
    subtitle: 'Soluções em Tecnologia',
  },
};

let brandingCache: PartnerBrandingRow[] | null = null;
let brandingCacheAt = 0;
const BRANDING_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '').trim();
}

function isLogoUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.trim().length > 0;
}

function isKnownPartnerName(value: string | null | undefined): value is PartnerName {
  return value === 'INOVAIA' || value === 'GT INOVA';
}

function getDefaultBranding(partnerName: PartnerName = DEFAULT_PARTNER_NAME): Omit<PartnerBranding, 'isLoading'> {
  return DEFAULT_BRANDING[partnerName];
}

/**
 * Domínios genéricos não ativam validação rígida de parceiro.
 * Em localhost/lovable, usamos branding default da INOVAIA.
 */
export function isGenericDomain(): boolean {
  if (typeof window === 'undefined') return true;

  const hostname = normalizeHostname(window.location.hostname);

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.lovable.app') ||
    hostname.endsWith('.lovableproject.com')
  );
}

function matchPartnerByHostname(
  rows: PartnerBrandingRow[],
  hostname: string
): PartnerBrandingRow | null {
  const normalizedHostname = normalizeHostname(hostname);

  const matches = rows.filter((row) => {
    const pattern = normalizeHostname(row.domain_pattern || '');
    if (!pattern) return false;

    return (
      normalizedHostname === pattern ||
      normalizedHostname.endsWith(`.${pattern}`) ||
      normalizedHostname.includes(pattern)
    );
  });

  if (matches.length === 0) return null;

  matches.sort((a, b) => b.domain_pattern.length - a.domain_pattern.length);
  return matches[0];
}

async function loadPartnerBrandingRows(): Promise<PartnerBrandingRow[]> {
  const now = Date.now();
  if (brandingCache && now - brandingCacheAt < BRANDING_CACHE_TTL_MS) {
    return brandingCache;
  }

  const { data, error } = await supabase
    .from('partner_branding')
    .select('partner_name, domain_pattern, logo_url, subtitle, primary_color')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ usePartnerBranding: erro ao buscar partner_branding:', error);
    return [];
  }

  const rows = (data || []) as PartnerBrandingRow[];
  brandingCache = rows;
  brandingCacheAt = now;

  return rows;
}

/**
 * Detecta o parceiro pelo hostname usando o banco.
 * Em domínio genérico, retorna INOVAIA por convenção visual local.
 * Em domínio desconhecido, tenta fallback para INOVAIA se existir no banco.
 */
export async function detectPartnerByHostname(): Promise<PartnerName> {
  if (typeof window === 'undefined') {
    return DEFAULT_PARTNER_NAME;
  }

  const hostname = normalizeHostname(window.location.hostname);

  if (isGenericDomain()) {
    return DEFAULT_PARTNER_NAME;
  }

  const rows = await loadPartnerBrandingRows();

  if (!rows.length) {
    console.warn('⚠️ detectPartnerByHostname: sem dados em partner_branding, usando fallback padrão.');
    return DEFAULT_PARTNER_NAME;
  }

  const matched = matchPartnerByHostname(rows, hostname);

  if (matched && isKnownPartnerName(matched.partner_name)) {
    return matched.partner_name;
  }

  const inovaiaRow = rows.find((row) => row.partner_name === 'INOVAIA');
  if (inovaiaRow) {
    return 'INOVAIA';
  }

  const firstKnown = rows.find((row) => isKnownPartnerName(row.partner_name));
  return firstKnown?.partner_name ?? DEFAULT_PARTNER_NAME;
}

export function usePartnerBranding(): PartnerBranding {
  const initialBranding = useMemo<PartnerBranding>(() => {
    const fallback = getDefaultBranding(DEFAULT_PARTNER_NAME);
    return {
      ...fallback,
      isLoading: true,
    };
  }, []);

  const [branding, setBranding] = useState<PartnerBranding>(initialBranding);

  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      try {
        if (typeof window === 'undefined') {
          if (!cancelled) {
            setBranding({
              ...getDefaultBranding(DEFAULT_PARTNER_NAME),
              isLoading: false,
            });
          }
          return;
        }

        const hostname = normalizeHostname(window.location.hostname);

        if (isGenericDomain()) {
          if (!cancelled) {
            setBranding({
              ...getDefaultBranding(DEFAULT_PARTNER_NAME),
              isLoading: false,
            });
          }
          return;
        }

        const rows = await loadPartnerBrandingRows();

        if (!rows.length) {
          if (!cancelled) {
            setBranding({
              ...getDefaultBranding(DEFAULT_PARTNER_NAME),
              isLoading: false,
            });
          }
          return;
        }

        const matched = matchPartnerByHostname(rows, hostname);
        const fallbackRow =
          rows.find((row) => row.partner_name === 'INOVAIA') ??
          rows.find((row) => isKnownPartnerName(row.partner_name)) ??
          null;

        const selected = matched ?? fallbackRow;

        if (!selected || !isKnownPartnerName(selected.partner_name)) {
          if (!cancelled) {
            setBranding({
              ...getDefaultBranding(DEFAULT_PARTNER_NAME),
              isLoading: false,
            });
          }
          return;
        }

        const defaultForPartner = getDefaultBranding(selected.partner_name);
        const logoSrc = isLogoUrl(selected.logo_url)
          ? selected.logo_url
          : LOCAL_PARTNER_LOGOS[selected.partner_name];

        if (!cancelled) {
          setBranding({
            partnerName: selected.partner_name,
            logoSrc,
            subtitle: selected.subtitle || defaultForPartner.subtitle,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('❌ usePartnerBranding: erro inesperado:', error);

        if (!cancelled) {
          setBranding({
            ...getDefaultBranding(DEFAULT_PARTNER_NAME),
            isLoading: false,
          });
        }
      }
    }

    loadBranding();

    return () => {
      cancelled = true;
    };
  }, []);

  return branding;
}