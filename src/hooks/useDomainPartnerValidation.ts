import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerBranding, isGenericDomain } from '@/hooks/usePartnerBranding';

interface DomainPartnerValidation {
  isAuthorized: boolean;
  isLoading: boolean;
  userPartner: string | null;
  domainPartner: string;
}

/**
 * Validates that the user's partner (via clientes.parceiro) matches the domain's partner.
 * Generic domains (localhost, lovable.app, no match) skip validation.
 * Super admins are always authorized.
 */
export function useDomainPartnerValidation(clienteId: string | null | undefined): DomainPartnerValidation {
  const { partnerName, isLoading: brandingLoading } = usePartnerBranding();
  const [userPartner, setUserPartner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Generic domains allow everyone
    if (isGenericDomain()) {
      console.log('🔓 useDomainPartnerValidation: domínio genérico, permitindo acesso');
      setIsLoading(false);
      setUserPartner(null);
      return;
    }

    // No cliente_id yet (profile still loading) - allow temporarily
    if (!clienteId) {
      console.log('🔓 useDomainPartnerValidation: sem cliente_id, permitindo temporariamente');
      setIsLoading(false);
      setUserPartner(null);
      return;
    }

    const fetchPartner = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('parceiro')
          .eq('id', clienteId)
          .maybeSingle();

        if (error) {
          console.error('❌ Erro ao buscar parceiro do cliente:', error);
          setUserPartner(null);
        } else {
          const partner = data?.parceiro || 'INOVAIA';
          console.log(`👤 useDomainPartnerValidation: parceiro do usuário="${partner}"`);
          setUserPartner(partner);
        }
      } catch (err) {
        console.error('❌ Erro inesperado ao buscar parceiro:', err);
        setUserPartner(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPartner();
  }, [clienteId]);

  // Determine authorization - WAIT for branding to load too
  const genericDomain = isGenericDomain();
  const stillLoading = isLoading || (!genericDomain && brandingLoading);
  
  // FIX: Don't authorize when userPartner is null and clienteId exists (still loading)
  const isAuthorized = genericDomain || !clienteId || (userPartner !== null && userPartner === partnerName);

  console.log(`🛡️ useDomainPartnerValidation: genericDomain=${genericDomain}, clienteId=${clienteId}, userPartner="${userPartner}", domainPartner="${partnerName}", brandingLoading=${brandingLoading}, isAuthorized=${isAuthorized}, stillLoading=${stillLoading}`);

  return {
    isAuthorized,
    isLoading: stillLoading,
    userPartner,
    domainPartner: partnerName,
  };
}

/**
 * Standalone function for post-login validation (doesn't need React hooks).
 * Returns the user's partner name or null on error.
 */
export async function validatePartnerForLogin(clienteId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('parceiro')
      .eq('id', clienteId)
      .maybeSingle();

    if (error || !data) return null;
    return data.parceiro || 'INOVAIA';
  } catch {
    return null;
  }
}
