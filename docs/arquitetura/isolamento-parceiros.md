# Isolamento de Parceiros — Documentação Técnica

**Versão:** 1.0  
**Data:** Abril 2026  
**Classificação:** Interna / Clientes

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [O Que é um Parceiro](#o-que-é-um-parceiro)
3. [Como Funciona o Isolamento](#como-funciona-o-isolamento)
4. [Fluxo de Acesso do Usuário](#fluxo-de-acesso-do-usuário)
5. [Domínios e Parceiros](#domínios-e-parceiros)
6. [Cadastro de Novos Usuários](#cadastro-de-novos-usuários)
7. [Perguntas Frequentes](#perguntas-frequentes)

---

## Visão Geral

O sistema opera em um modelo **multi-parceiro**, onde cada parceiro comercial possui seu próprio ambiente de acesso isolado. Isso significa que:

- **Usuários da INOVAIA** acessam exclusivamente pelo domínio da INOVAIA.
- **Usuários da GT INOVA** acessam exclusivamente pelo domínio da GT INOVA.
- **Nenhum usuário de um parceiro consegue acessar o sistema pelo domínio de outro parceiro.**

Esse isolamento garante segurança, privacidade e separação completa de dados entre os parceiros.

---

## O Que é um Parceiro

Um **parceiro** é a empresa revendedora ou operadora do sistema. Cada parceiro possui:

| Atributo | Descrição |
|---|---|
| **Nome** | Identificação do parceiro (ex: `INOVAIA`, `GT INOVA`) |
| **Domínio** | URL de acesso exclusiva (ex: `agenda-clinic-sync.lovable.app`, `gt.inovaia-automacao.com.br`) |
| **Logo** | Logotipo exibido na tela de login e no painel |
| **Clínicas vinculadas** | Cada clínica pertence a exatamente um parceiro |

### Clínicas por Parceiro

| Parceiro | Clínicas |
|---|---|
| **INOVAIA** | IPADO, ENDOGASTRO, Clínica Orion |
| **GT INOVA** | Clínica Olhos (HOP), Clínica Vênus |

---

## Como Funciona o Isolamento

O isolamento opera em **três camadas de segurança**:

### Camada 1 — Domínio de Acesso

Cada parceiro possui um domínio exclusivo. Ao acessar o sistema, o domínio é detectado automaticamente e determina qual parceiro está sendo acessado.

```
agenda-clinic-sync.lovable.app  →  Parceiro INOVAIA
gt.inovaia-automacao.com.br     →  Parceiro GT INOVA
```

### Camada 2 — Validação no Login

Ao fazer login, o sistema verifica se o **parceiro do usuário** (definido pela clínica à qual ele pertence) corresponde ao **parceiro do domínio** que está sendo acessado.

- Se corresponder: acesso liberado.
- Se não corresponder: acesso **bloqueado** com mensagem de erro, e o usuário é desconectado automaticamente.

**Exemplo prático:**
- Um funcionário da **Clínica Olhos (HOP)** tenta acessar pelo domínio da INOVAIA.
- O sistema detecta que a Clínica Olhos pertence ao parceiro **GT INOVA**.
- Como o domínio é da **INOVAIA**, o acesso é **negado**.

### Camada 3 — Barreira Contínua (AuthGuard)

Mesmo após o login, o sistema monitora continuamente se o parceiro do usuário corresponde ao domínio. Se houver inconsistência (por exemplo, um token de sessão sendo usado em outro domínio), o acesso é bloqueado imediatamente.

---

## Fluxo de Acesso do Usuário

```
┌─────────────────────────────────────────────────────────────────┐
│                    Usuário acessa o sistema                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  Detecta o domínio    │
                │  (INOVAIA ou GT INOVA)│
                └───────────┬───────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │  Usuário faz login    │
                └───────────┬───────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │ Parceiro do usuário = domínio? │
              └──────┬──────────────┬────────┘
                     │              │
                   SIM             NÃO
                     │              │
                     ▼              ▼
            ┌──────────────┐  ┌──────────────────┐
            │ Acesso       │  │ Acesso BLOQUEADO  │
            │ LIBERADO     │  │ "Seu usuário      │
            │              │  │  pertence a outro  │
            │              │  │  parceiro"         │
            └──────────────┘  └──────────────────┘
```

---

## Domínios e Parceiros

### Tabela `partner_branding`

O sistema utiliza a tabela `partner_branding` no banco de dados para mapear domínios a parceiros:

| Parceiro | Padrão de Domínio | Logo | Subtítulo |
|---|---|---|---|
| INOVAIA | `agenda-clinic-sync` | Logo INOVAIA | Sistema de Agendamentos Médicos |
| GT INOVA | `gt.inovaia` | Logo GT INOVA | Soluções em Tecnologia |

### Tabela `clientes`

Cada clínica possui a coluna `parceiro` que define a qual parceiro ela pertence:

| Clínica | Parceiro |
|---|---|
| IPADO | INOVAIA |
| ENDOGASTRO | INOVAIA |
| Clínica Orion | INOVAIA |
| Hospital de Olhos Petrolina (HOP) | GT INOVA |
| Clínica Vênus | GT INOVA |

---

## Cadastro de Novos Usuários

Ao se cadastrar, o sistema:

1. Detecta o parceiro pelo domínio de acesso.
2. Filtra as clínicas disponíveis para seleção, exibindo **apenas as clínicas do parceiro correspondente**.
3. Vincula o novo usuário à clínica selecionada.

**Exemplo:**
- Cadastro via domínio GT INOVA → só aparecem Clínica Olhos (HOP) e Clínica Vênus.
- Cadastro via domínio INOVAIA → só aparecem IPADO, ENDOGASTRO e Clínica Orion.

---

## Perguntas Frequentes

### Um funcionário da GT INOVA consegue acessar os dados da INOVAIA?
**Não.** O sistema bloqueia o login pelo domínio errado e, adicionalmente, o banco de dados possui políticas de segurança (RLS) que impedem o acesso a dados de outra clínica.

### E se alguém tentar acessar diretamente pela URL de outro parceiro?
O sistema verifica o parceiro do usuário a cada acesso. Mesmo com credenciais válidas, o login será bloqueado se o domínio não corresponder ao parceiro do usuário.

### O que acontece em ambientes de desenvolvimento (localhost)?
Em ambientes de desenvolvimento, a validação de parceiro é desativada para facilitar os testes. Todas as clínicas ficam visíveis.

### Como adicionar uma nova clínica a um parceiro?
Basta cadastrar a clínica no banco de dados com o campo `parceiro` preenchido com o nome do parceiro desejado (ex: `GT INOVA` ou `INOVAIA`).

### Como criar um novo parceiro?
1. Inserir um registro na tabela `partner_branding` com o domínio e logo do novo parceiro.
2. Configurar o domínio/DNS para apontar para o sistema.
3. Cadastrar as clínicas com o campo `parceiro` correspondente.

---

## Resumo da Segurança

| Camada | Mecanismo | Quando Atua |
|---|---|---|
| **Domínio** | Detecção automática do parceiro pelo hostname | Ao abrir o sistema |
| **Login** | Validação do parceiro do usuário vs. domínio | Ao fazer login |
| **Sessão** | AuthGuard monitora parceiro continuamente | Durante toda a sessão |
| **Banco de dados** | RLS (Row Level Security) por `cliente_id` | Em toda consulta ao banco |
| **Cadastro** | Filtro de clínicas por parceiro no signup | Ao criar conta |

---

*Documento gerado pela equipe de engenharia — Abril 2026*
