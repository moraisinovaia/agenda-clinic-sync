// Função para enviar WhatsApp via Evolution API
export async function enviarWhatsAppEvolution(celular: string, mensagem: string): Promise<boolean> {
  try {
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const evolutionInstance = Deno.env.get('EVOLUTION_INSTANCE');

    if (!evolutionApiUrl || !evolutionApiKey || !evolutionInstance) {
      console.warn('⚠️ [WHATSAPP] Evolution API não configurada. Mensagem não enviada.');
      return false;
    }

    // Formatar número para formato internacional
    const numeroFormatado = formatarNumeroWhatsApp(celular);
    
    if (!numeroFormatado) {
      console.warn(`⚠️ [WHATSAPP] Número inválido: ${celular}`);
      return false;
    }

    const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        number: numeroFormatado,
        text: mensagem
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [WHATSAPP] Erro na API Evolution: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`✅ [WHATSAPP] Mensagem enviada para ${numeroFormatado}`);
    return true;
  } catch (error) {
    console.error('❌ [WHATSAPP] Erro ao enviar mensagem:', error);
    return false;
  }
}

// Formatar número para WhatsApp (55 + DDD + número)
function formatarNumeroWhatsApp(celular: string): string | null {
  if (!celular) return null;
  
  // Remover caracteres não numéricos
  const numeros = celular.replace(/\D/g, '');
  
  // Se já tem 13 dígitos (55 + DDD + 9 dígitos), está ok
  if (numeros.length === 13 && numeros.startsWith('55')) {
    return numeros;
  }
  
  // Se tem 11 dígitos (DDD + 9 dígitos), adicionar 55
  if (numeros.length === 11) {
    return `55${numeros}`;
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos), adicionar 55 e 9
  if (numeros.length === 10) {
    const ddd = numeros.substring(0, 2);
    const numero = numeros.substring(2);
    return `55${ddd}9${numero}`;
  }
  
  console.warn(`⚠️ [WHATSAPP] Formato de número não reconhecido: ${celular} (${numeros.length} dígitos)`);
  return null;
}
