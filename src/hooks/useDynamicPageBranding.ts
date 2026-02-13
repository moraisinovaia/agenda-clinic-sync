import { useEffect } from 'react';
import { usePartnerBranding } from '@/hooks/usePartnerBranding';

/**
 * Atualiza dinamicamente o título da aba e o favicon com base no parceiro detectado pelo domínio.
 */
export function useDynamicPageBranding() {
  const { partnerName, subtitle, isLoading } = usePartnerBranding();

  useEffect(() => {
    if (isLoading) return;

    // Update document title
    document.title = `${partnerName} - ${subtitle}`;

    // Update favicon
    const faviconPath = partnerName === 'GT INOVA' ? '/gt-inova-icon-192.png' : '/icon-192.png';

    const updateLink = (selector: string, href: string) => {
      const el = document.querySelector(selector) as HTMLLinkElement | null;
      if (el) el.href = href;
    };

    updateLink('link[rel="icon"]', faviconPath);
    updateLink('link[rel="apple-touch-icon"]', faviconPath);
  }, [partnerName, subtitle, isLoading]);
}
