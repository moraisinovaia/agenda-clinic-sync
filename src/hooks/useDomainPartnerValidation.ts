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
  const { partnerName } = usePartnerBranding();
  const [userPartner, setUserPartner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Generic domains allow everyone
    if (isGenericDomain()) {
      setIsLoading(false);
      setUserPartner(null);
      return;
    }

    // No cliente_id yet (profile still loading) - allow temporarily
    if (!clienteId) {
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
          setUserPartner(data?.parceiro || 'INOVAIA');
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

  // Determine authorization
  const genericDomain = isGenericDomain();
  const isAuthorized = genericDomain || !clienteId || !userPartner || userPartner === partnerName;

  return {
    isAuthorized,
    isLoading,
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
