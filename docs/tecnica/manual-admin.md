# 🔧 Manual do Administrador - Sistema Endogastro

## 📋 Índice

1. [Visão Geral do Sistema](#visão-geral)
2. [Primeiros Passos](#primeiros-passos)
3. [Gestão de Usuários](#gestão-de-usuários)
4. [Configuração de Médicos](#configuração-de-médicos)
5. [Gestão de Atendimentos](#gestão-de-atendimentos)
6. [Configuração de Preparos](#configuração-de-preparos)
7. [Integrações](#integrações)
8. [Relatórios e Dashboard](#relatórios-e-dashboard)
9. [Backup e Segurança](#backup-e-segurança)
10. [Solução de Problemas](#solução-de-problemas)

---

## 🎯 Visão Geral do Sistema {#visão-geral}

### Arquitetura do Sistema
O Sistema Endogastro é construído em arquitetura moderna cloud-native:

- **Frontend:** React + TypeScript (interface responsiva)
- **Backend:** Supabase + PostgreSQL (banco de dados escalável)
- **Segurança:** Row Level Security (RLS) + Auditoria completa
- **Integrações:** WhatsApp Business API, Resend Email, N8N

### Principais Módulos
- 📅 **Agendamentos:** Gestão completa de consultas e exames
- 👥 **Pacientes:** Cadastro e histórico de pacientes
- 👨‍⚕️ **Médicos:** Gestão de profissionais e especialidades
- 🔄 **Fila de Espera:** Otimização automática de cancelamentos
- 📱 **Comunicação:** WhatsApp e email automáticos
- 📊 **Dashboard:** Métricas e relatórios em tempo real
- ⚙️ **Configurações:** Personalização do sistema

---

## 🚀 Primeiros Passos {#primeiros-passos}

### Acesso ao Sistema
1. **URL:** https://seu-dominio.endogastro.com.br
2. **Login:** Use suas credenciais de administrador
3. **Dashboard:** Tela principal com visão geral

### Configuração Inicial

#### 1. Configuração da Clínica
```
Menu: Configurações > Dados da Clínica
```
- Nome da clínica
- Endereço completo
- Telefones de contato
- CNPJ e dados fiscais
- Logo da clínica (formato PNG/JPG)

#### 2. Configuração de Horários
```
Menu: Configurações > Horários de Funcionamento
```
- Horário de abertura e fechamento
- Dias de funcionamento
- Intervalos de consulta (padrão: 30 minutos)
- Horários especiais (feriados, eventos)

#### 3. Integração WhatsApp
```
Menu: Integrações > WhatsApp Business API
```
**Pré-requisitos:**
- Conta WhatsApp Business verificada
- API Key da Evolution API
- Número de telefone dedicado

**Configuração:**
1. Insira a URL da Evolution API
2. Configure a API Key
3. Defina o nome da instância
4. Teste a conexão

#### 4. Configuração de Email
```
Menu: Integrações > Email (Resend)
```
1. Criar conta no Resend.com
2. Verificar domínio de email
3. Gerar API Key
4. Configurar no sistema
5. Testar envio

---

## 👥 Gestão de Usuários {#gestão-de-usuários}

### Tipos de Usuário
- **Administrador:** Acesso total ao sistema
- **Recepcionista:** Agendamentos e consultas
- **Médico:** Visualização de sua agenda
- **Gestor:** Relatórios e dashboard

### Criação de Usuários

#### Processo de Aprovação
1. Usuário se cadastra no sistema
2. Status fica como "Pendente"
3. Administrador revisa e aprova
4. Email de confirmação é enviado automaticamente

#### Aprovação Manual
```
Menu: Administração > Usuários Pendentes
```
1. Listar usuários pendentes
2. Revisar dados do usuário
3. Definir perfil de acesso
4. Aprovar ou rejeitar
5. Sistema envia email automático

### Gestão de Perfis

#### Permissões por Perfil
```
Administrador:
✅ Todas as funcionalidades
✅ Gestão de usuários
✅ Configurações do sistema
✅ Relatórios completos

Recepcionista:
✅ Agendamentos
✅ Cadastro de pacientes
✅ Fila de espera
❌ Configurações
❌ Relatórios financeiros

Médico:
✅ Visualizar sua agenda
✅ Atualizar status de consultas
❌ Agendamentos
❌ Configurações

Gestor:
✅ Dashboard executivo
✅ Relatórios completos
✅ Métricas operacionais
❌ Configurações técnicas
```

---

## 👨‍⚕️ Configuração de Médicos {#configuração-de-médicos}

### Cadastro de Médicos

#### Dados Básicos
```
Menu: Cadastros > Médicos > Novo Médico
```
**Informações Obrigatórias:**
- Nome completo
- CRM e especialidade
- Email de contato
- Telefone/celular

**Informações Opcionais:**
- Foto do profissional
- Observações específicas
- Status (ativo/inativo)

#### Configuração de Horários
```
Menu: Cadastros > Médicos > [Médico] > Horários
```

**Estrutura JSON dos Horários:**
```json
{
  "segunda": {
    "ativo": true,
    "inicio": "08:00",
    "fim": "17:00",
    "intervalo_inicio": "12:00",
    "intervalo_fim": "13:00",
    "duracao_consulta": 30
  },
  "terca": {
    "ativo": true,
    "inicio": "08:00",
    "fim": "17:00"
  }
}
```

#### Restrições de Idade
```
Menu: Cadastros > Médicos > [Médico] > Restrições
```
- **Idade mínima:** Ex: 18 anos (para adultos)
- **Idade máxima:** Ex: 17 anos (para pediatria)
- Sistema valida automaticamente no agendamento

#### Convênios Aceitos
```
Menu: Cadastros > Médicos > [Médico] > Convênios
```
- Lista de convênios aceitos
- Validação automática no agendamento
- Configuração de coparticipação por convênio

---

## 🏥 Gestão de Atendimentos {#gestão-de-atendimentos}

### Tipos de Atendimento

#### Categorias Principais
- **Consulta:** Primeira consulta, retorno
- **Exame:** Endoscopia, colonoscopia, ultrassom
- **Procedimento:** Polipectomia, biópsia
- **Urgência:** Atendimentos emergenciais

#### Cadastro de Atendimentos
```
Menu: Cadastros > Atendimentos > Novo Atendimento
```

**Campos Obrigatórios:**
- Nome do atendimento
- Tipo (consulta/exame/procedimento)
- Duração padrão (minutos)

**Campos Opcionais:**
- Código do procedimento
- Valor particular
- Valor coparticipação (20% e 40%)
- Observações específicas
- Restrições especiais

#### Horários Específicos
```json
{
  "duracao": 30,
  "intervalos_permitidos": ["08:00", "08:30", "09:00"],
  "dias_semana": [1, 2, 3, 4, 5],
  "requer_jejum": true,
  "tempo_preparo": 24
}
```

### Preparos por Atendimento

#### Configuração de Preparos
```
Menu: Cadastros > Preparos > Novo Preparo
```

**Estrutura do Preparo:**
```json
{
  "nome": "Preparo para Colonoscopia",
  "exame": "Colonoscopia",
  "jejum_horas": 12,
  "dias_suspensao": 3,
  "instrucoes": {
    "3_dias_antes": [
      "Suspender medicamentos anti-inflamatórios",
      "Evitar alimentos com fibras"
    ],
    "1_dia_antes": [
      "Dieta líquida",
      "Iniciar laxante às 18h"
    ],
    "dia_exame": [
      "Jejum absoluto",
      "Comparecer 30 min antes"
    ]
  },
  "medicacao_suspender": "Anti-inflamatórios, anticoagulantes",
  "itens_levar": "Documentos, exames anteriores",
  "restricoes_alimentares": "Sementes, nozes, verduras folhosas"
}
```

---

## 🔌 Integrações {#integrações}

### WhatsApp Business API

#### Configuração da Evolution API
```
Menu: Integrações > WhatsApp > Configuração
```

**Parâmetros Necessários:**
- **URL da API:** https://evolutionapi.inovaia.online
- **API Key:** Chave de acesso fornecida
- **Nome da Instância:** Nome único da instância
- **Número do WhatsApp:** Número verificado

#### Teste de Conexão
```
Menu: Integrações > WhatsApp > Teste
```
1. Clique em "Testar Conexão"
2. Verifique status da instância
3. Envie mensagem de teste
4. Confirme recebimento

#### Configuração de Templates
```
Menu: Integrações > WhatsApp > Templates
```

**Template de Preparo:**
```
Olá {paciente_nome}! 

Você tem {exame_nome} agendado para {data} às {hora} com {medico_nome}.

📋 PREPAROS IMPORTANTES:
{instrucoes_preparo}

⏰ JEJUM: {jejum_horas} horas antes
💊 MEDICAÇÕES: {medicacoes_suspender}
📝 LEVAR: {itens_levar}

📞 Dúvidas? Ligue (11) 99999-9999
🏥 Clínica Endogastro
```

### Integração de Email

#### Configuração Resend
```
Menu: Integrações > Email > Configuração
```

**Passos:**
1. Criar conta no Resend.com
2. Verificar domínio de envio
3. Gerar API Key
4. Configurar no sistema
5. Testar envio

#### Templates de Email
```
Menu: Integrações > Email > Templates
```

**Template de Confirmação:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Confirmação de Agendamento</title>
</head>
<body>
    <h2>Agendamento Confirmado</h2>
    <p>Olá {paciente_nome},</p>
    
    <p>Seu {exame_nome} foi agendado com sucesso:</p>
    
    <ul>
        <li><strong>Data:</strong> {data_agendamento}</li>
        <li><strong>Horário:</strong> {hora_agendamento}</li>
        <li><strong>Médico:</strong> {medico_nome}</li>
        <li><strong>Local:</strong> {clinica_endereco}</li>
    </ul>
    
    <p>Preparos serão enviados via WhatsApp.</p>
    
    <p>Atenciosamente,<br>Equipe Endogastro</p>
</body>
</html>
```

---

## 📊 Relatórios e Dashboard {#relatórios-e-dashboard}

### Dashboard Executivo

#### Métricas Principais
```
Menu: Dashboard > Visão Geral
```

**KPIs Operacionais:**
- Taxa de ocupação da agenda
- Índice de no-shows
- Tempo médio de atendimento
- Agendamentos por médico
- Utilização da fila de espera

**KPIs Financeiros:**
- Faturamento por período
- Faturamento por médico
- Faturamento por convênio
- Receita per capita
- Projeção mensal

#### Gráficos Interativos
- Agendamentos por dia/semana/mês
- Distribuição por tipo de exame
- Performance por médico
- Evolução do faturamento
- Análise de cancelamentos

### Relatórios Específicos

#### Relatório de Agendamentos
```
Menu: Relatórios > Agendamentos
```

**Filtros Disponíveis:**
- Período (data inicial/final)
- Médico específico
- Status (agendado/confirmado/realizado/cancelado)
- Tipo de atendimento
- Convênio

**Dados Exportados:**
- Paciente, médico, data/hora
- Tipo de atendimento
- Status atual
- Observações
- Dados de contato

#### Relatório Financeiro
```
Menu: Relatórios > Financeiro
```

**Informações Incluídas:**
- Faturamento bruto/líquido
- Distribuição por convênio
- Performance por médico
- Análise de coparticipação
- Projeções de receita

#### Relatório de Performance
```
Menu: Relatórios > Performance Operacional
```

**Métricas Analisadas:**
- Taxa de no-shows por médico
- Eficiência da fila de espera
- Tempo médio de agendamento
- Preparos enviados vs. não enviados
- Satisfação do paciente

### Exportação de Dados

#### Formatos Disponíveis
- **Excel (.xlsx):** Para análises detalhadas
- **PDF:** Para relatórios executivos
- **CSV:** Para integração com outros sistemas

#### Agendamento de Relatórios
```
Menu: Relatórios > Agendamento Automático
```
- Definir periodicidade (diário/semanal/mensal)
- Selecionar destinatários
- Configurar horário de envio
- Personalizar conteúdo

---

## 🔒 Backup e Segurança {#backup-e-segurança}

### Sistema de Backup

#### Backup Automático
- **Frequência:** Diário (02:00 AM)
- **Retenção:** 30 dias para backups diários
- **Local:** Cloud storage criptografado
- **Validação:** Teste automático de integridade

#### Backup Manual
```
Menu: Administração > Backup > Criar Backup
```
1. Selecionar dados para backup
2. Definir nome descritivo
3. Executar backup
4. Verificar status

#### Restauração
```
Menu: Administração > Backup > Restaurar
```
⚠️ **ATENÇÃO:** Restauração substitui dados atuais
1. Selecionar backup para restaurar
2. Confirmar ação
3. Aguardar processo
4. Verificar integridade

### Auditoria e Logs

#### Sistema de Auditoria
Todas as ações são automaticamente registradas:
- **Quem:** ID do usuário
- **Quando:** Timestamp preciso
- **O quê:** Ação realizada
- **Onde:** IP de origem
- **Como:** Resultado da ação

#### Consulta de Logs
```
Menu: Administração > Auditoria > Logs do Sistema
```

**Filtros Disponíveis:**
- Período
- Usuário
- Tipo de ação
- Nível (info/warning/error)
- Recurso acessado

#### Relatório de Conformidade LGPD
```
Menu: Administração > LGPD > Relatório de Conformidade
```
- Acessos a dados pessoais
- Alterações em informações sensíveis
- Tentativas de acesso negadas
- Exportações de dados realizadas

### Segurança

#### Controle de Acesso
- **Autenticação:** Email + senha forte
- **Autorização:** Role-based (RLS)
- **Sessão:** Timeout automático
- **MFA:** Two-factor authentication (opcional)

#### Políticas de Senha
- Mínimo 8 caracteres
- Caracteres especiais obrigatórios
- Renovação a cada 90 dias
- Histórico de senhas (últimas 5)

#### Monitoramento
- Tentativas de login falhadas
- Acessos fora do horário
- IPs suspeitos
- Alterações em dados críticos

---

## 🛠️ Solução de Problemas {#solução-de-problemas}

### Problemas Comuns

#### 1. WhatsApp não está enviando
**Sintomas:** Preparos não chegam ao paciente
**Possíveis Causas:**
- API Key expirada
- Instância desconectada
- Número bloqueado

**Solução:**
```
1. Menu: Integrações > WhatsApp > Status
2. Verificar conexão da instância
3. Testar envio manual
4. Reconectar se necessário
```

#### 2. Emails não estão sendo enviados
**Sintomas:** Confirmações não chegam
**Possíveis Causas:**
- API Key inválida
- Domínio não verificado
- Limite de envio atingido

**Solução:**
```
1. Menu: Integrações > Email > Status
2. Verificar configuração Resend
3. Validar domínio de envio
4. Verificar logs de erro
```

#### 3. Dashboard não carrega métricas
**Sintomas:** Gráficos vazios ou erro de carregamento
**Possíveis Causas:**
- Problema de conexão com banco
- Consulta muito pesada
- Cache desatualizado

**Solução:**
```
1. Menu: Administração > Sistema > Diagnóstico
2. Verificar status do banco de dados
3. Limpar cache do sistema
4. Reexecutar consultas
```

#### 4. Fila de espera não funciona
**Sintomas:** Pacientes não são notificados em cancelamentos
**Possíveis Causas:**
- Trigger desabilitado
- Configuração incorreta
- Erro na lógica de priorização

**Solução:**
```
1. Menu: Configurações > Fila de Espera
2. Verificar ativação do sistema
3. Testar com cancelamento manual
4. Revisar logs de processamento
```

### Logs e Diagnóstico

#### Acesso aos Logs
```
Menu: Administração > Sistema > Logs
```

**Tipos de Log:**
- **Application:** Funcionamento do sistema
- **Integration:** WhatsApp, email, APIs
- **Database:** Consultas e transações
- **Audit:** Ações dos usuários

#### Ferramentas de Diagnóstico
```
Menu: Administração > Sistema > Diagnóstico
```

**Verificações Automáticas:**
- ✅ Conexão com banco de dados
- ✅ Status das integrações
- ✅ Espaço em disco
- ✅ Performance do sistema
- ✅ Validade dos certificados

### Contato com Suporte

#### Suporte Técnico
- **Email:** suporte@endogastro.com.br
- **WhatsApp:** (11) 88888-8888
- **Portal:** suporte.endogastro.com.br
- **Horário:** 24/7 (clientes Enterprise)

#### Informações para o Suporte
Sempre forneça:
1. **URL da instância**
2. **Usuário que reportou o problema**
3. **Horário que ocorreu o erro**
4. **Passos para reproduzir**
5. **Screenshots ou logs relevantes**

#### Escalação
- **Nível 1:** Problemas gerais (resposta em 4h)
- **Nível 2:** Problemas técnicos (resposta em 2h)
- **Nível 3:** Problemas críticos (resposta em 30min)

---

## 📚 Recursos Adicionais

### Documentação
- [Manual do Usuário](./manual-usuario.md)
- [Guia de Instalação](./guia-instalacao.md)
- [Documentação da API](./api-docs.md)
- [Arquitetura do Sistema](./arquitetura-sistema.md)

### Treinamento
- Vídeos tutoriais disponíveis
- Webinars mensais
- Treinamento presencial (disponível)
- Certificação de usuários

### Comunidade
- Forum de usuários
- Grupo no WhatsApp
- Newsletter mensal
- Eventos e workshops

---

**Sistema Endogastro - Manual do Administrador v2.0**
*Última atualização: Janeiro 2025*