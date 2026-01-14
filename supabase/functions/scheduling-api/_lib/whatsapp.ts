// Função para enviar WhatsApp via Evolution API
// ⚠️ SEGURANÇA: Todas as credenciais DEVEM vir de variáveis de ambiente
export async function enviarWhatsAppEvolution(celular: string, mensagem: string) {
  try {
    const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    // Validação de segurança: não permitir execução sem credenciais configuradas
    if (!evolutionUrl || !apiKey || !instanceName) {
      console.error('❌ [SEGURANÇA] Credenciais Evolution API não configuradas.');
      throw new Error('Evolution API credentials not configured. Set EVOLUTION_API_URL, EVOLUTION_API_KEY, and EVOLUTION_INSTANCE_NAME.');
    }

    console.log(`📱 Enviando WhatsApp via Evolution API para: ${celular}`);

    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: celular,
        text: mensagem
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao enviar WhatsApp: ${response.status} - ${errorText}`);
      throw new Error(`Evolution API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ WhatsApp enviado com sucesso:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro na integração Evolution API:', error);
    throw error;
  }
}