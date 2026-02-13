

# Configurar Logo e Dominio da GT INOVA

## O que sera feito

### 1. Copiar a nova logo para o projeto
A logo enviada sera salva em `src/assets/gt-inova-logo-new.jpeg` (substituindo a versao antiga usada como fallback no codigo).

### 2. Atualizar o arquivo de fallback local
O arquivo `src/hooks/usePartnerBranding.ts` tem um mapeamento local de logos como fallback. Sera atualizado para usar a nova logo da GT INOVA.

### 3. Atualizar o `domain_pattern` no banco de dados
O registro da GT INOVA na tabela `partner_branding` atualmente tem o pattern `gtinova`. Como o dominio sera `GT.inovaia-automacao.com.br`, o pattern precisa ser ajustado para detectar corretamente esse dominio. Sera atualizado para `gt.inovaia-automacao` (tudo minusculo, pois o hostname e comparado em lowercase).

### 4. Atualizar o subtitle da GT INOVA
Baseado na logo, o subtitle sera ajustado para "Solucoes Inovadoras" em vez do generico "Sistema de Agendamentos Medicos".

## Passos manuais que voce precisara fazer depois

### Configurar o dominio no Lovable
1. Abra seu projeto no Lovable
2. Va em **Settings** (engrenagem no canto superior direito) > **Domains**
3. Clique em **Connect Domain**
4. Digite: `GT.inovaia-automacao.com.br`
5. Siga as instrucoes na tela

### Configurar o DNS no registrador do dominio
No painel onde voce comprou/gerencia o dominio `inovaia-automacao.com.br`:
- Adicione um **registro A** com nome `GT` apontando para `185.158.133.1`
- Adicione o **registro TXT** que o Lovable fornecer para verificacao

---

## Detalhes tecnicos

**Arquivos modificados:**
- `src/assets/gt-inova-logo-new.jpeg` -- nova logo copiada do upload
- `src/hooks/usePartnerBranding.ts` -- atualizar import da logo GT INOVA
- Migracao SQL -- atualizar `domain_pattern` e `subtitle` na tabela `partner_branding`

**Logica de deteccao:**
Quando alguem acessar `GT.inovaia-automacao.com.br`, o hostname sera `gt.inovaia-automacao.com.br`. O sistema buscara na tabela `partner_branding` um registro cujo `domain_pattern` apareca no hostname. Com o pattern `gt.inovaia-automacao`, tera match com GT INOVA e exibira a logo e branding corretos.

