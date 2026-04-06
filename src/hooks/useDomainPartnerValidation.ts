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
 * Valida se o parceiro do usuário (via clientes.parceiro)
 * corresponde ao parceiro resolvido pelo domínio atual.
 *
 * Regras:
 * - Domínios genéricos (localhost, lovable, etc.) permitem acesso para facilitar desenvolvimento.
 * - Sem cliente_id ainda (profile carregando) permite temporariamente.
 * - Se não encontrar parceiro do cliente, NÃO força fallback de parceiro.
 */
export function useDomainPartnerValidation(
  clienteId: string | null | undefined
): DomainPartnerValidation {
  const { partnerName, isLoading: brandingLoading } = usePartnerBranding();
  const [userPartner, setUserPartner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isGenericDomain()) {
      console.log('🔓 useDomainPartnerValidation: domínio genérico, permitindo acesso');
      setIsLoading(false);
      setUserPartner(null);
      return;
    }

    if (!clienteId) {
      console.log('🔓 useDomainPartnerValidation: sem cliente_id, permitindo temporariamente');
      setIsLoading(false);
      setUserPartner(null);
      return;
    }

    let cancelled = false;

    const fetchPartner = async () => {
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('parceiro')
          .eq('id', clienteId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('❌ Erro ao buscar parceiro do cliente:', error);
          setUserPartner(null);
          return;
        }

        const partner = data?.parceiro ?? null;
        console.log(`👤 useDomainPartnerValidation: parceiro do usuário="${partner}"`);
        setUserPartner(partner);
      } catch (err) {
        if (cancelled) return;
        console.error('❌ Erro inesperado ao buscar parceiro:', err);
        setUserPartner(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPartner();

    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const genericDomain = isGenericDomain();
  const stillLoading = isLoading || (!genericDomain && brandingLoading);

  const isAuthorized =
    genericDomain ||
    !clienteId ||
    (userPartner !== null && userPartner === partnerName);

  console.log(
    `🛡️ useDomainPartnerValidation: genericDomain=${genericDomain}, clienteId=${clienteId}, userPartner="${userPartner}", domainPartner="${partnerName}", brandingLoading=${brandingLoading}, isAuthorized=${isAuthorized}, stillLoading=${stillLoading}`
  );

  return {
    isAuthorized,
    isLoading: stillLoading,
    userPartner,
    domainPartner: partnerName,
  };
}

/**
 * Função standalone para validação pós-login.
 * Retorna o parceiro do usuário ou null se não encontrar.
 */
export async function validatePartnerForLogin(
  clienteId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('parceiro')
      .eq('id', clienteId)
      .maybeSingle();

    if (error || !data) return null;

    return data.parceiro ?? null;
  } catch {
    return null;
  }
}