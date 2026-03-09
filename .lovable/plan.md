

## Problema

O LLM (Gemini) envia o nome "Dr. Marcelo De Carli Cavalcanti" mas no banco está cadastrado como "Dr. Marcelo D'Carli". A normalização atual transforma:

- **Banco**: `"dr marcelo dcarli"` (o apóstrofo é removido, juntando "D" e "Carli")
- **LLM**: `"dr marcelo de carli cavalcanti"`

Nenhum contém o outro → `MEDICO_NAO_ENCONTRADO`.

## Solução

Adicionar **matching por palavras-chave** como fallback nos dois locais de busca de médico (linhas ~2043 e ~5128). Quando o match simples (`includes`) falha, usar um score baseado em palavras em comum:

1. Extrair palavras significativas (ignorando "dr", "dra", "de", "da", "do", "dos")
2. Contar quantas palavras do nome buscado aparecem no nome do médico (e vice-versa)
3. Se ≥50% das palavras significativas fazem match, considerar como encontrado
4. Ordenar por score e pegar o melhor match

Isso resolve variações como:
- "Marcelo De Carli Cavalcanti" → match com "Marcelo D'Carli" (palavras "marcelo" e "carli" em comum)
- "Adriana Sena" → match com "Adriana Carla de Sena"

## Alterações

**Arquivo**: `supabase/functions/llm-agent-api/index.ts`

Criar uma função utilitária `fuzzyMatchMedico` e usá-la nos dois locais de busca:

- **Linha ~2043** (handler de schedule/availability por nome)
- **Linha ~5128** (handler de availability principal)

A função:
```text
function fuzzyMatchMedico(nomeInput, listaMedicos):
  1. Tentar match exato normalizado (já existente)
  2. Se falhar, extrair palavras significativas
  3. Calcular score de overlap para cada médico
  4. Retornar médicos com score ≥ 0.5, ordenados por score desc
```

Stopwords a ignorar: `["dr", "dra", "de", "da", "do", "dos", "das", "e"]`

## Deploy

Após editar, deploy via `supabase--deploy_edge_functions` e testar com o mesmo payload que falhou.

