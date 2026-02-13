
# Documentacao Tecnica Real do Sistema - Fevereiro 2026

## 1. Visao Geral

Sistema SaaS multi-tenant de agendamento medico construido com React + TypeScript no frontend e Supabase (PostgreSQL + Edge Functions) no backend. Atende clinicas de gastroenterologia e oftalmologia com isolamento de dados por `cliente_id`.

**Stack tecnologico:**
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query
- Backend: Supabase (PostgreSQL 15), Edge Functions (Deno)
- Integracao externa: n8n (orquestrador de IA), WhatsApp via Evolution API

**Numeros reais do banco de dados (producao):**
- 5 clinicas ativas: IPADO (6 medicos), ENDOGASTRO (21 medicos), Clinica Venus (2 medicos), Clinica Olhos (7 medicos), Clinica Orion (6 medicos)
- 1 clinica inativa: INOVAIA (legado)
- 42 medicos ativos
- 7.629 pacientes cadastrados
- 1.747 agendamentos futuros
- 23 usuarios aprovados

**Parceiros:**
- INOVAIA: IPADO, ENDOGASTRO, Clinica Venus, Clinica Orion
- GT INOVA: Clinica Olhos (unico cliente)

---

## 2. Arquitetura do Frontend

### Paginas (apenas 3)
- `/auth` - Login, cadastro, recuperacao de senha
- `/` - Dashboard principal (protegido por AuthGuard)
- `/*` - Pagina 404

### Fluxo de autenticacao
1. `AuthProvider` (contexto global) gerencia sessao Supabase
2. `AuthGuard` protege rota `/` - redireciona para `/auth` se nao autenticado
3. `DomainGuard` (camada 2) valida se o parceiro do usuario corresponde ao dominio acessado
4. Validacao adicional no `handleLogin` do `Auth.tsx` (pos-login, antes de liberar acesso)

### Telas internas (viewMode no Index.tsx)
O sistema usa uma unica pagina (`Index.tsx` com 932 linhas) que alterna entre views via estado `viewMode`:
- `doctors` - Dashboard principal com cards de medicos (recepcionista) ou painel admin com abas (admin)
- `schedule` - Agenda do medico selecionado (calendario + lista de horarios)
- `new-appointment` - Formulario de novo agendamento
- `edit-appointment` - Edicao de agendamento existente
- `multiple-appointment` - Modal de agendamento multiplo
- `appointments-list` - Lista geral de agendamentos com filtros
- `canceled-appointments` - Lista de agendamentos cancelados/excluidos
- `fila-espera` - Listagem da fila de espera
- `nova-fila` - Formulario para adicionar a fila
- `bloqueio-agenda` - Gerenciamento de bloqueios de agenda
- `relatorio-agenda` - Relatorio de agenda

### Painel administrativo (abas dentro de viewMode 'doctors')
Visivel apenas para admins e admins de clinica:
- **Dashboard** (admin global): MultiClinicDashboard
- **Usuarios**: Aprovacao/rejeicao de usuarios pendentes
- **Clinicas** (admin global): Gerenciamento de clinicas
- **Medicos**: CRUD de medicos
- **Servicos**: CRUD de atendimentos/procedimentos
- **Preparos**: CRUD de preparos de exames
- **Horarios**: Configuracao de horarios dos medicos
- **LLM API**: Configuracao de regras de negocio para o agente de IA

### Sistema de roles
- `admin` - Administrador global (ve todas as clinicas)
- `admin_clinica` - Administrador de clinica (ve apenas sua clinica)
- `recepcionista` - Operador padrao (agendamentos, pacientes)

Roles armazenados na tabela `user_roles` (separado de `profiles`), verificados via funcao `has_role()` SECURITY DEFINER.

---

## 3. Banco de Dados (29 tabelas)

### Tabelas principais
- `clientes` - Clinicas/tenants (nome, parceiro, logo_url, configuracoes)
- `profiles` - Perfis de usuario (nome, email, status, cliente_id, cargo)
- `user_roles` - Roles dos usuarios (user_id, role)
- `medicos` - Medicos (nome, CRM, especialidade, convenios, restricoes de idade)
- `pacientes` - Pacientes (nome, data nascimento, convenio, telefone)
- `atendimentos` - Tipos de servico (consulta, exame, procedimento, valores)
- `agendamentos` - Agendamentos (paciente, medico, data, hora, status, auditoria completa)

### Tabelas de suporte operacional
- `bloqueios_agenda` - Periodos bloqueados na agenda dos medicos
- `fila_espera` - Fila de espera por medico/atendimento
- `fila_notificacoes` - Notificacoes da fila de espera
- `horarios_vazios` - Slots disponiveis gerados manualmente
- `horarios_configuracao` - Configuracao de horarios (tabela legada, business_rules e a fonte principal)
- `preparos` - Instrucoes de preparo para exames
- `distribuicao_recursos` - Distribuicao de recursos/equipamentos por medico/dia
- `recursos_equipamentos` - Cadastro de recursos/equipamentos

### Tabelas de configuracao LLM
- `business_rules` - Regras de negocio por medico/clinica (JSONB) - fonte unica de verdade
- `business_rules_audit` - Auditoria de mudancas nas regras
- `llm_clinic_config` - Configuracao geral da clinica para o agente LLM
- `llm_mensagens` - Mensagens personalizadas por tipo/medico

### Tabelas de auditoria e logs
- `audit_logs` - Log completo de acoes (quem, quando, o que, IP)
- `notification_logs` - Logs de notificacoes enviadas
- `notificacoes_enviadas` - Registro de notificacoes (WhatsApp/email)
- `confirmacoes_automaticas` - Registro de confirmacoes automaticas
- `system_logs` - Logs do sistema
- `system_backups` - Registro de backups
- `system_settings` - Configuracoes do sistema

### Tabelas de branding
- `partner_branding` - Logo e identidade visual por parceiro/dominio
- `configuracoes_clinica` - Configuracoes especificas por clinica

### Tabela legada
- `backup_migracao_endogastro` - Backup da migracao do sistema antigo

### Isolamento de dados (RLS)
Todas as tabelas principais usam Row Level Security com `cliente_id = get_user_cliente_id()`. Super admins bypassam via `is_super_admin()`. Politicas sao RESTRICTIVE (nao PERMISSIVE), exigindo match explicito.

---

## 4. Edge Functions (20 funcoes)

### API principal do agente LLM
- `llm-agent-api` - API central (6755 linhas, v3.2.0) com 10 endpoints: verificar_paciente, consultar_disponibilidade, agendar_consulta, remarcar_consulta, cancelar_consulta, confirmar_consulta, listar_medicos, info_clinica, entre outros. Carrega regras dinamicamente do banco.

### Proxies de clinica (thin proxies)
- `llm-agent-api-venus` - Proxy para Clinica Venus
- `llm-agent-api-orion` - Proxy para Clinica Orion
- `llm-agent-api-olhos` - Proxy para Clinica Olhos
- `llm-agent-api-marcelo` - Proxy para medico/clinica especifica

### APIs operacionais
- `scheduling-api` - API REST para agendamentos (CRUD + disponibilidade)
- `n8n-api` - Endpoints especificos para integracao n8n
- `bloqueio-agenda` - Gerenciamento de bloqueios
- `whatsapp-availability` - Verificacao de disponibilidade via WhatsApp

### Funcoes de suporte
- `user-management` - Gerenciamento de usuarios
- `clinic-data` - Dados da clinica
- `notification-scheduler` - Agendador de notificacoes
- `fila-notificacao` - Processamento de notificacoes da fila
- `notificar-bloqueio` - Notificacao de bloqueios
- `gmail-alerts` - Alertas por email
- `system-logs` - Gerenciamento de logs
- `auto-backup` / `backup-system` - Sistema de backup
- `fix-approved-users-emails` - Correcao de emails de usuarios aprovados
- `create-test-user` - Criacao de usuario de teste

### Configuracao de seguranca
Todas as edge functions tem `verify_jwt = false` no `config.toml`. Isso significa que nenhuma funcao exige token JWT para ser chamada. A autenticacao/autorizacao e feita internamente quando necessario.

---

## 5. Sistema de Branding Multi-Parceiro

### Como funciona
1. `index.html` tem script sincrono que detecta hostname e troca titulo/favicon/manifest antes do React
2. `usePartnerBranding` consulta tabela `partner_branding` para detectar parceiro pelo dominio
3. `useClinicBranding` busca logo da clinica especifica (prioridade) com fallback para logo do parceiro
4. `useDynamicPageBranding` atualiza titulo e favicon apos React montar
5. `useDomainPartnerValidation` bloqueia acesso se parceiro do usuario nao bate com dominio

### Dominios configurados
- `gt.inovaia-automacao*` → GT INOVA
- `inovaia*` → INOVAIA (match mais curto, fallback)

### PWA
- `manifest.json` - Manifest INOVAIA (padrao)
- `manifest-gt-inova.json` - Manifest GT INOVA (carregado dinamicamente)

---

## 6. Problemas e Limitacoes Conhecidos

### Problemas de arquitetura
1. **Index.tsx monolitico**: 932 linhas em um unico componente que gerencia todas as views. Deveria usar React Router com rotas separadas.
2. **AuthProvider sem provider no App.tsx**: O `AuthProvider` esta no `main.tsx`, mas o `useAuth` e usado em `App.tsx` via `useDynamicPageBranding` que chama `usePartnerBranding` (que nao usa auth). Funciona por acaso, mas a estrutura e fragil.
3. **Console.log excessivo em producao**: Dezenas de logs de debug (emojis inclusos) sao impressos no console do navegador. Nao ha mecanismo para desabilitar em producao.

### Problemas de seguranca
4. **Todas edge functions com verify_jwt = false**: Qualquer pessoa pode chamar as edge functions sem autenticacao. A seguranca depende da logica interna de cada funcao.
5. **Linter do Supabase reporta 5 warnings**:
   - Funcoes com search_path mutavel (risco de SQL injection)
   - Extensoes instaladas no schema public (2x)
   - Protecao contra senhas vazadas desabilitada
   - Versao do Postgres com patches de seguranca pendentes
6. **`horarios_configuracao` ainda existe**: A memoria do sistema diz que essa tabela foi removida como desnecessaria, mas ela ainda existe no banco com politicas RLS ativas. Inconsistencia entre documentacao e realidade.

### Problemas de UX
7. **Loading state hardcoded como INOVAIA**: Na linha 575 do `Index.tsx`, durante carregamento de dados, o texto exibido e "INOVAIA" em vez de usar o branding dinamico. Clientes GT INOVA veem "INOVAIA" brevemente.
8. **Flash de branding atenuado mas nao eliminado**: O script inline no `index.html` resolve para titulo/favicon, mas componentes React ainda podem mostrar default antes do branding carregar.
9. **Sem rotas profundas**: Nao e possivel compartilhar link direto para uma tela especifica (ex: agenda de um medico). Tudo e estado interno do `Index.tsx`.

### Problemas tecnicos
10. **Cliente INOVAIA inativo no banco**: Existe um registro `INOVAIA` com `ativo=false` que parece ser legado. Pode causar confusao.
11. **Tabela `horarios_configuracao` possivelmente orfã**: Conforme memoria do sistema, `business_rules` e a fonte unica de verdade, mas `horarios_configuracao` ainda existe e pode ter dados desatualizados.
12. **TODO nao implementado**: `GlobalErrorBoundary.tsx` tem TODO para enviar erros a servico externo de logging - nunca implementado.
13. **Sem testes automatizados**: Nao ha arquivos de teste no projeto (nem unitarios, nem de integracao, nem E2E).
14. **Sem CI/CD**: Deploy e feito via Lovable publish. Sem pipeline de validacao.

### Dados e performance
15. **Limite de 1000 rows do Supabase**: O sistema usa paginacao via RPC (`get_agendamentos_completos_paged`) mas o fallback manual pode perder dados em clinicas com muitos agendamentos.
16. **Polling a cada 60s para horarios vazios**: Pode causar carga desnecessaria em producao com muitos usuarios simultaneos.

---

## 7. Integracao com n8n e WhatsApp

### Arquitetura
- n8n atua como orquestrador entre WhatsApp (Evolution API) e o sistema
- O no "AI Agent" do n8n interpreta intencao do paciente e chama as ferramentas da `llm-agent-api`
- 10 ferramentas disponiveis: verificar_paciente, consultar_disponibilidade, agendar_consulta, remarcar_consulta, cancelar_consulta, confirmar_consulta, listar_medicos, info_clinica, etc.
- Cada clinica tem um proxy (edge function) que injeta o `cliente_id` correto

### Estado atual
- IPADO: Configurado e em uso
- ENDOGASTRO: Configurado e em uso
- Clinica Venus: Proxy criado
- Clinica Olhos: Proxy criado
- Clinica Orion: Proxy criado

### Limitacao
Nao ha como verificar se os workflows n8n estao ativos ou funcionando a partir do sistema. A integracao depende de infraestrutura externa sem monitoramento.

---

## 8. Funcionalidades que EXISTEM

- Login com email ou username + senha
- Cadastro com selecao de clinica
- Recuperacao de senha por email
- Aprovacao manual de usuarios por admin
- CRUD de medicos, servicos, preparos
- Agendamento simples e multiplo
- Edicao e cancelamento de agendamentos
- Confirmacao/desconfirmacao de agendamentos
- Fila de espera com prioridade
- Bloqueio de agenda por periodo
- Gerador de horarios vazios
- Relatorio de agenda
- Dashboard com estatisticas (cards)
- Painel multi-clinica (admin global)
- Configuracao de regras LLM via admin
- Auditoria de agendamentos (historico)
- Filtros avancados na lista de agendamentos
- Paginacao na lista de agendamentos
- Atalhos de teclado (Ctrl+N, Ctrl+M, Ctrl+L, etc.)
- Deteccao de Google Translate (aviso ao usuario)
- PWA instalavel (com branding por dominio)
- Tema claro/escuro
- Notificacoes in-app (toast)
- Isolamento de dados por clinica (RLS)
- Isolamento de acesso por dominio/parceiro

## 9. Funcionalidades que NAO EXISTEM (apesar de mencionadas na documentacao comercial)

- **Relatorios financeiros**: Nao ha tela de faturamento, receita ou analise financeira
- **Exportacao de dados** (Excel, PDF, CSV): Nao implementado
- **Agendamento de relatorios automaticos**: Nao existe
- **MFA / Two-factor authentication**: Nao implementado
- **Politica de renovacao de senha a cada 90 dias**: Nao implementada
- **Historico de senhas**: Nao implementado
- **Forum de usuarios / comunidade**: Nao existe
- **Videos tutoriais / webinars**: Nao existem
- **Certificacao de usuarios**: Nao existe
- **Demonstracao interativa**: Nao existe
- **Integracao com Resend Email funcional**: O codigo existe mas nao ha evidencia de configuracao ativa (secrets nao verificados)
- **Monitoramento de IPs suspeitos**: Nao implementado
- **Verificacao de espaco em disco**: Nao implementado
- **Validacao de certificados**: Nao aplicavel (hospedado no Supabase/Lovable)
