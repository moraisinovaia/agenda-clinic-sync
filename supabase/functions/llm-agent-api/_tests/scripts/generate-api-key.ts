/**
 * Gera uma API key para um tenant e a registra em `api_keys`.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     deno run --allow-all generate-api-key.ts <cliente_id> [label]
 *
 * Exemplo:
 *   deno run --allow-all generate-api-key.ts 2bfb98b5-... "n8n-prod"
 *
 * Saída: a RAW KEY (mostrada UMA vez, copiar pro n8n) + UUID da entry.
 * O hash é salvo no banco; a raw key NÃO é armazenada.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) {
  console.error('Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no env.');
  Deno.exit(1);
}

const [clienteId, label] = Deno.args;
if (!clienteId) {
  console.error('Uso: deno run --allow-all generate-api-key.ts <cliente_id> [label]');
  Deno.exit(1);
}

const supabase = createClient(url, key);

// Verifica que cliente_id existe
const { data: cliente, error: cErr } = await supabase
  .from('clientes')
  .select('id, nome')
  .eq('id', clienteId)
  .maybeSingle();
if (cErr || !cliente) {
  console.error(`Cliente ${clienteId} não encontrado.`);
  Deno.exit(2);
}

// Gera 32 bytes random → hex (64 chars)
const raw = crypto.getRandomValues(new Uint8Array(32));
const rawHex = Array.from(raw).map((b) => b.toString(16).padStart(2, '0')).join('');
const apiKey = `lak_${rawHex}`; // prefix 'lak_' = llm-agent-key

// SHA-256 hex
const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
const keyHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');

const { data, error } = await supabase
  .from('api_keys')
  .insert({
    cliente_id: clienteId,
    key_hash:   keyHash,
    label:      label ?? null,
    ativo:      true,
  })
  .select('id, created_at')
  .single();

if (error) {
  console.error('Erro ao registrar:', error.message);
  Deno.exit(3);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ API key gerada para cliente:', cliente.nome);
console.log('   cliente_id:', clienteId);
console.log('   api_key_id:', data.id);
console.log('   label:     ', label ?? '(sem label)');
console.log('   created_at:', data.created_at);
console.log('───────────────────────────────────────────────────────────────');
console.log('🔑 RAW KEY (copie agora — não vai aparecer de novo):');
console.log('');
console.log('   ', apiKey);
console.log('');
console.log('   ↑ Salvar em N8N como x-api-key. Hash SHA-256 ficou no banco.');
console.log('═══════════════════════════════════════════════════════════════');
