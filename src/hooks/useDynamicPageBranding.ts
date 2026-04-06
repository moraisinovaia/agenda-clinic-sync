import { useEffect } from 'react';
import { usePartnerBranding } from '@/hooks/usePartnerBranding';

/**
 * Atualiza dinamicamente o título da aba e o favicon
 * com base no parceiro resolvido pelo branding atual.
 */
export function useDynamicPageBranding() {
  const { partnerName, subtitle, isLoading } = usePartnerBranding();

  useEffect(() => {
    if (isLoading) return;

    document.title = `${partnerName} - ${subtitle}`;

    const faviconPath =
      partnerName === 'GT INOVA' ? '/gt-inova-icon-192.png' : '/icon-192.png';

    const updateLink = (selector: string, href: string) => {
      const el = document.querySelector(selector) as HTMLLinkElement | null;
      if (el) el.href = href;
    };

    updateLink('link[rel="icon"]', faviconPath);
    updateLink('link[rel="apple-touch-icon"]', faviconPath);
  }, [partnerName, subtitle, isLoading]);
}