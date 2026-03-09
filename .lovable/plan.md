

## Comparação: Documento Dr. Marcelo vs Sistema Atual

Analisei o documento completo e comparei com as `business_rules` no banco. Encontrei **divergências significativas** que precisam ser corrigidas.

---

### DIVERGÊNCIAS IDENTIFICADAS

#### 1. Consulta Cardiológica — Horários ERRADOS

| Item | Documento | Sistema Atual |
|------|-----------|---------------|
| **Manhã — dias** | Seg, Ter, Qui (3 dias) | Seg, Ter, Qui, **Sex** (4 dias) |
| **Ficha manhã** | 07:00 às **10:30** | 07:00 às **10:00** |
| **Ficha tarde** | 13:00 às **15:30** | 13:00 às **15:00** |
| **Limite por turno** | **15** pacientes | **9** pacientes |
| **Valor desconto** | R$ 330 | Não cadastrado |
| **Pacote Consulta+ECG** | R$ 400 | Não cadastrado |

**Sexta-feira está errada**: no sistema, Sex manhã tem consulta regular. No documento, Sex manhã **não tem** consulta regular. Sexta à tarde é agenda **exclusiva particular** (consulta + teste + ECG, 10 pacientes total, a partir de 14h).

#### 2. Teste Ergométrico — Ficha horários ERRADOS

| Item | Documento | Sistema |
|------|-----------|---------|
| **Ficha manhã** | 07:00 às **10:30** | 07:00 às **10:00** |
| **Ficha tarde** | 13:00 às **15:30** | 13:00 às **15:00** |

#### 3. ECG — Dias ERRADOS

| Item | Documento | Sistema |
|------|-----------|---------|
| **Manhã** | Seg, Ter, Qui (dias 1,2,4) | Seg, Ter, Qui, **Sex** (1,2,4,5) |
| **Tarde** | **Seg**, Qua (dias 1,3) | **Apenas** Qua (dia 3) |

Falta Segunda-feira tarde no ECG. Sexta manhã não deveria ter ECG regular.

#### 4. Convênios — UNIMED VSF ausente
O documento lista **UNIMED VSF** como convênio aceito para consultas, mas no sistema está ausente da lista de convênios do Dr. Marcelo.

#### 5. Sexta Particular — NÃO EXISTE no sistema
Agenda exclusiva sexta à tarde: consultas + teste + ECG, apenas particular, 10 pacientes total, atendimento 14h, ficha 13:00-15:00. Precisa ser criada.

#### 6. Informações NÃO cadastradas
- **Parecer cardiológico**: regras especiais (necessita consulta + ECG, exceção se ECG recente < 3 meses)
- **Texto MAPA vs MRPA**: explicação detalhada para quando paciente pedir "MAPA" genérico
- **Indicações de exames que não faz**: tabela com locais recomendados (Ecocardiograma → IPADO/CARDIOVASF, Holter → CARDIOVASF, etc.)
- **Receita**: deve usar palavra-chave para transferir para secretárias
- **Urgências**: recomendar emergência e colocar em lista preferencial
- **3 confirmações**: Dr. Marcelo quer 3 confirmações (3 dias, 2 dias, 1 dia antes)
- **NFe/PIX**: dados de pagamento PIX (CNPJ e telefone)
- **Crianças**: atende apenas para parecer cardiológico pré-operatório
- **Plano HGU**: quando guia autorizada como "Teste Ergométrico Computadorizado", faz ECG + Teste juntos

---

### PLANO DE CORREÇÃO

**Etapa 1 — Corrigir business_rules do Dr. Marcelo (config_id `a1b2c3d4...`)**

Atualizar o JSON de `config` para:
- Consulta: manhã dias [1,2,4], ficha até 10:30, limite 15
- Consulta: tarde dias [1,3], ficha até 15:30, limite 15
- ECG: manhã dias [1,2,4], tarde dias [1,3]
- Remover sexta da consulta e ECG regulares
- Adicionar UNIMED VSF aos convênios
- Adicionar valor_desconto (330) e pacote consulta+ECG (400)
- Teste Ergométrico: ficha manhã até 10:30, tarde até 15:30
- Adicionar regra crianças (apenas parecer pré-operatório)

**Etapa 2 — Criar serviço "Agenda Particular Sexta" ou config separada**

Sexta-feira tarde com:
- Consulta + Teste Ergométrico + ECG, apenas particular
- 10 pacientes total (compartilhados)
- Atendimento a partir de 14h, ficha 13:00-15:00
- Valores: Consulta R$350/330, Teste R$240/220, ECG R$80/70

**Etapa 3 — Adicionar mensagens em `llm_mensagens`**

Cadastrar mensagens do tipo:
- `parecer_cardiologico` — regras específicas
- `mapa_vs_mrpa` — texto explicativo das diferenças
- `indicacoes_exames` — tabela de locais para exames que não realiza
- `urgencia` — orientar para emergência
- `receita` — frase-chave para handoff às secretárias
- `confirmacao_consulta` e `confirmacao_exame` — textos de cancelamento 24h e falta
- `nota_fiscal` — dados PIX e prazos NFe

**Etapa 4 — Redeploy da Edge Function**

Após atualizar os dados no banco, redeploy do `llm-agent-api` para limpar cache.

---

### Alterações técnicas

- **Banco**: UPDATE em `business_rules` (2 registros: Dr. Marcelo principal + Teste Ergométrico)
- **Banco**: INSERT em `llm_mensagens` (~8 mensagens novas)
- **Banco**: Possível INSERT em `business_rules` para agenda particular sexta
- **Edge Function**: redeploy para limpar cache
- **Nenhuma alteração em código frontend**

