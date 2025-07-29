export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      access_audit: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          resource: string
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource: string
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          resource?: string
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agendamentos: {
        Row: {
          atendimento_id: string
          cancelado_em: string | null
          cancelado_por: string | null
          cancelado_por_user_id: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          confirmado_por_user_id: string | null
          convenio: string | null
          created_at: string
          criado_por: string
          criado_por_user_id: string | null
          data_agendamento: string
          hora_agendamento: string
          id: string
          medico_id: string
          observacoes: string | null
          paciente_id: string
          status: string
          updated_at: string
        }
        Insert: {
          atendimento_id: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelado_por_user_id?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          confirmado_por_user_id?: string | null
          convenio?: string | null
          created_at?: string
          criado_por?: string
          criado_por_user_id?: string | null
          data_agendamento: string
          hora_agendamento: string
          id?: string
          medico_id: string
          observacoes?: string | null
          paciente_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          atendimento_id?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelado_por_user_id?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          confirmado_por_user_id?: string | null
          convenio?: string | null
          created_at?: string
          criado_por?: string
          criado_por_user_id?: string | null
          data_agendamento?: string
          hora_agendamento?: string
          id?: string
          medico_id?: string
          observacoes?: string | null
          paciente_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_exames_combinaveis"
            referencedColumns: ["atendimento1_id"]
          },
          {
            foreignKeyName: "agendamentos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_exames_combinaveis"
            referencedColumns: ["atendimento2_id"]
          },
          {
            foreignKeyName: "agendamentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos_audit: {
        Row: {
          action: string
          agendamento_id: string
          changed_at: string | null
          changed_by: string | null
          id: string
          ip_address: unknown | null
          new_data: Json | null
          old_data: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          agendamento_id: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          agendamento_id?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      alertas_criticos: {
        Row: {
          acao_tomada: string | null
          destinatarios: Json | null
          erro_detectado: string | null
          id: string
          log_auditoria_id: string | null
          notificado: boolean | null
          notificado_em: string | null
          pergunta: string | null
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          resposta_problemática: string | null
          severidade: number
          timestamp: string | null
          tipo: string
          usuario_afetado: string | null
        }
        Insert: {
          acao_tomada?: string | null
          destinatarios?: Json | null
          erro_detectado?: string | null
          id?: string
          log_auditoria_id?: string | null
          notificado?: boolean | null
          notificado_em?: string | null
          pergunta?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resposta_problemática?: string | null
          severidade?: number
          timestamp?: string | null
          tipo: string
          usuario_afetado?: string | null
        }
        Update: {
          acao_tomada?: string | null
          destinatarios?: Json | null
          erro_detectado?: string | null
          id?: string
          log_auditoria_id?: string | null
          notificado?: boolean | null
          notificado_em?: string | null
          pergunta?: string | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          resposta_problemática?: string | null
          severidade?: number
          timestamp?: string | null
          tipo?: string
          usuario_afetado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alertas_criticos_log_auditoria_id_fkey"
            columns: ["log_auditoria_id"]
            isOneToOne: false
            referencedRelation: "logs_auditoria_medica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_criticos_log_auditoria_id_fkey"
            columns: ["log_auditoria_id"]
            isOneToOne: false
            referencedRelation: "vw_auditoria_critica"
            referencedColumns: ["id"]
          },
        ]
      }
      alimentos_teste_hidrogenio: {
        Row: {
          categoria: string | null
          evitados: string[] | null
          id: string
          observacoes: string | null
          permitidos: string[] | null
        }
        Insert: {
          categoria?: string | null
          evitados?: string[] | null
          id?: string
          observacoes?: string | null
          permitidos?: string[] | null
        }
        Update: {
          categoria?: string | null
          evitados?: string[] | null
          id?: string
          observacoes?: string | null
          permitidos?: string[] | null
        }
        Relationships: []
      }
      atendimentos: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          coparticipacao_unimed_20: number | null
          coparticipacao_unimed_40: number | null
          created_at: string | null
          forma_pagamento: string | null
          horarios: Json | null
          id: string
          medico_id: string | null
          medico_nome: string | null
          nome: string
          observacoes: string | null
          restricoes: string | null
          tipo: string
          valor_particular: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          coparticipacao_unimed_20?: number | null
          coparticipacao_unimed_40?: number | null
          created_at?: string | null
          forma_pagamento?: string | null
          horarios?: Json | null
          id?: string
          medico_id?: string | null
          medico_nome?: string | null
          nome: string
          observacoes?: string | null
          restricoes?: string | null
          tipo: string
          valor_particular?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          coparticipacao_unimed_20?: number | null
          coparticipacao_unimed_40?: number | null
          created_at?: string | null
          forma_pagamento?: string | null
          horarios?: Json | null
          id?: string
          medico_id?: string | null
          medico_nome?: string | null
          nome?: string
          observacoes?: string | null
          restricoes?: string | null
          tipo?: string
          valor_particular?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_agenda: {
        Row: {
          created_at: string
          criado_por: string
          criado_por_user_id: string | null
          data_fim: string
          data_inicio: string
          id: string
          medico_id: string
          motivo: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          criado_por_user_id?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          medico_id: string
          motivo: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          criado_por_user_id?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          medico_id?: string
          motivo?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      clinica_valores: {
        Row: {
          categoria: string
          codigo_procedimento: string | null
          created_at: string | null
          forma_pagamento: string | null
          id: number
          observacoes: string | null
          procedimento: string
          valor_principal: number | null
          valor_unimed_coparticipacao_20: number | null
          valor_unimed_coparticipacao_40: number | null
        }
        Insert: {
          categoria: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento: string
          valor_principal?: number | null
          valor_unimed_coparticipacao_20?: number | null
          valor_unimed_coparticipacao_40?: number | null
        }
        Update: {
          categoria?: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento?: string
          valor_principal?: number | null
          valor_unimed_coparticipacao_20?: number | null
          valor_unimed_coparticipacao_40?: number | null
        }
        Relationships: []
      }
      config_sistema_auditoria: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          categoria: string | null
          chave: string
          criado_em: string | null
          descricao: string | null
          editavel: boolean | null
          requer_reinicio: boolean | null
          tipo: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria?: string | null
          chave: string
          criado_em?: string | null
          descricao?: string | null
          editavel?: boolean | null
          requer_reinicio?: boolean | null
          tipo?: string | null
          valor: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria?: string | null
          chave?: string
          criado_em?: string | null
          descricao?: string | null
          editavel?: boolean | null
          requer_reinicio?: boolean | null
          tipo?: string | null
          valor?: string
        }
        Relationships: []
      }
      configuracoes_clinica: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          chave: string
          created_at: string | null
          dados_extras: Json | null
          id: string
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          chave: string
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          valor: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          chave?: string
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          valor?: string
        }
        Relationships: []
      }
      fila_espera: {
        Row: {
          agendamento_id: string | null
          atendimento_id: string
          created_at: string
          data_limite: string | null
          data_preferida: string
          id: string
          medico_id: string
          observacoes: string | null
          paciente_id: string
          periodo_preferido: string | null
          prioridade: number | null
          status: string | null
          tentativas_contato: number | null
          ultimo_contato: string | null
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          atendimento_id: string
          created_at?: string
          data_limite?: string | null
          data_preferida: string
          id?: string
          medico_id: string
          observacoes?: string | null
          paciente_id: string
          periodo_preferido?: string | null
          prioridade?: number | null
          status?: string | null
          tentativas_contato?: number | null
          ultimo_contato?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          atendimento_id?: string
          created_at?: string
          data_limite?: string | null
          data_preferida?: string
          id?: string
          medico_id?: string
          observacoes?: string | null
          paciente_id?: string
          periodo_preferido?: string | null
          prioridade?: number | null
          status?: string | null
          tentativas_contato?: number | null
          ultimo_contato?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_fila_agendamento"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fila_atendimento"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fila_atendimento"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_exames_combinaveis"
            referencedColumns: ["atendimento1_id"]
          },
          {
            foreignKeyName: "fk_fila_atendimento"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_exames_combinaveis"
            referencedColumns: ["atendimento2_id"]
          },
          {
            foreignKeyName: "fk_fila_medico"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fila_paciente"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fila_notificacoes: {
        Row: {
          canal_notificacao: string | null
          created_at: string
          data_agendamento: string
          fila_id: string
          hora_agendamento: string
          horario_disponivel: string
          id: string
          resposta_paciente: string | null
          status_envio: string | null
          tempo_limite: string
        }
        Insert: {
          canal_notificacao?: string | null
          created_at?: string
          data_agendamento: string
          fila_id: string
          hora_agendamento: string
          horario_disponivel: string
          id?: string
          resposta_paciente?: string | null
          status_envio?: string | null
          tempo_limite: string
        }
        Update: {
          canal_notificacao?: string | null
          created_at?: string
          data_agendamento?: string
          fila_id?: string
          hora_agendamento?: string
          horario_disponivel?: string
          id?: string
          resposta_paciente?: string | null
          status_envio?: string | null
          tempo_limite?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notif_fila"
            columns: ["fila_id"]
            isOneToOne: false
            referencedRelation: "fila_espera"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_auditoria_medica: {
        Row: {
          alertas_gerados: Json | null
          ambiente: string | null
          auditoria_completa: Json | null
          categoria: string
          dados_utilizados: Json | null
          erros_detectados: Json | null
          fonte_dados: string | null
          hash_resposta: string | null
          id: string
          pergunta_normalizada: string | null
          pergunta_original: string
          precisao: string | null
          processamento: string
          requer_revisao: boolean | null
          resposta_gerada: string
          revisado_em: string | null
          revisado_por: string | null
          sucesso: boolean | null
          timestamp: string | null
          tipo_pergunta: string
          usuario_nome: string | null
          usuario_telefone: string | null
          validacao_passou: boolean | null
          versao_sistema: string | null
        }
        Insert: {
          alertas_gerados?: Json | null
          ambiente?: string | null
          auditoria_completa?: Json | null
          categoria: string
          dados_utilizados?: Json | null
          erros_detectados?: Json | null
          fonte_dados?: string | null
          hash_resposta?: string | null
          id?: string
          pergunta_normalizada?: string | null
          pergunta_original: string
          precisao?: string | null
          processamento: string
          requer_revisao?: boolean | null
          resposta_gerada: string
          revisado_em?: string | null
          revisado_por?: string | null
          sucesso?: boolean | null
          timestamp?: string | null
          tipo_pergunta: string
          usuario_nome?: string | null
          usuario_telefone?: string | null
          validacao_passou?: boolean | null
          versao_sistema?: string | null
        }
        Update: {
          alertas_gerados?: Json | null
          ambiente?: string | null
          auditoria_completa?: Json | null
          categoria?: string
          dados_utilizados?: Json | null
          erros_detectados?: Json | null
          fonte_dados?: string | null
          hash_resposta?: string | null
          id?: string
          pergunta_normalizada?: string | null
          pergunta_original?: string
          precisao?: string | null
          processamento?: string
          requer_revisao?: boolean | null
          resposta_gerada?: string
          revisado_em?: string | null
          revisado_por?: string | null
          sucesso?: boolean | null
          timestamp?: string | null
          tipo_pergunta?: string
          usuario_nome?: string | null
          usuario_telefone?: string | null
          validacao_passou?: boolean | null
          versao_sistema?: string | null
        }
        Relationships: []
      }
      medicos: {
        Row: {
          ativo: boolean | null
          convenios_aceitos: string[] | null
          convenios_restricoes: Json | null
          created_at: string | null
          especialidade: string
          horarios: Json | null
          id: string
          idade_maxima: number | null
          idade_minima: number | null
          nome: string
          observacoes: string | null
        }
        Insert: {
          ativo?: boolean | null
          convenios_aceitos?: string[] | null
          convenios_restricoes?: Json | null
          created_at?: string | null
          especialidade: string
          horarios?: Json | null
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          nome: string
          observacoes?: string | null
        }
        Update: {
          ativo?: boolean | null
          convenios_aceitos?: string[] | null
          convenios_restricoes?: Json | null
          created_at?: string | null
          especialidade?: string
          horarios?: Json | null
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          nome?: string
          observacoes?: string | null
        }
        Relationships: []
      }
      metricas_diarias: {
        Row: {
          alertas_criticos: number | null
          alertas_gerados: number | null
          atualizado_em: string | null
          criticas_corretas: number | null
          criticas_incorretas: number | null
          data: string | null
          erros: number | null
          id: string
          revisoes_concluidas: number | null
          revisoes_necessarias: number | null
          sucessos: number | null
          taxa_sucesso: number | null
          tempo_maximo_resposta: number | null
          tempo_medio_resposta: number | null
          total_conversacionais: number | null
          total_criticas: number | null
          total_informativas: number | null
          total_interacoes: number | null
        }
        Insert: {
          alertas_criticos?: number | null
          alertas_gerados?: number | null
          atualizado_em?: string | null
          criticas_corretas?: number | null
          criticas_incorretas?: number | null
          data?: string | null
          erros?: number | null
          id?: string
          revisoes_concluidas?: number | null
          revisoes_necessarias?: number | null
          sucessos?: number | null
          taxa_sucesso?: number | null
          tempo_maximo_resposta?: number | null
          tempo_medio_resposta?: number | null
          total_conversacionais?: number | null
          total_criticas?: number | null
          total_informativas?: number | null
          total_interacoes?: number | null
        }
        Update: {
          alertas_criticos?: number | null
          alertas_gerados?: number | null
          atualizado_em?: string | null
          criticas_corretas?: number | null
          criticas_incorretas?: number | null
          data?: string | null
          erros?: number | null
          id?: string
          revisoes_concluidas?: number | null
          revisoes_necessarias?: number | null
          sucessos?: number | null
          taxa_sucesso?: number | null
          tempo_maximo_resposta?: number | null
          tempo_medio_resposta?: number | null
          total_conversacionais?: number | null
          total_criticas?: number | null
          total_informativas?: number | null
          total_interacoes?: number | null
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          celular: string | null
          convenio: string
          created_at: string
          data_nascimento: string
          id: string
          nome_completo: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          celular?: string | null
          convenio: string
          created_at?: string
          data_nascimento: string
          id?: string
          nome_completo: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          celular?: string | null
          convenio?: string
          created_at?: string
          data_nascimento?: string
          id?: string
          nome_completo?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      preparos: {
        Row: {
          created_at: string | null
          dias_suspensao: number | null
          exame: string
          forma_pagamento: string | null
          id: string
          instrucoes: Json | null
          itens_levar: string | null
          jejum_horas: number | null
          medicacao_suspender: string | null
          nome: string
          observacoes_especiais: string | null
          observacoes_valor: string | null
          restricoes_alimentares: string | null
          valor_convenio: number | null
          valor_particular: number | null
        }
        Insert: {
          created_at?: string | null
          dias_suspensao?: number | null
          exame: string
          forma_pagamento?: string | null
          id?: string
          instrucoes?: Json | null
          itens_levar?: string | null
          jejum_horas?: number | null
          medicacao_suspender?: string | null
          nome: string
          observacoes_especiais?: string | null
          observacoes_valor?: string | null
          restricoes_alimentares?: string | null
          valor_convenio?: number | null
          valor_particular?: number | null
        }
        Update: {
          created_at?: string | null
          dias_suspensao?: number | null
          exame?: string
          forma_pagamento?: string | null
          id?: string
          instrucoes?: Json | null
          itens_levar?: string | null
          jejum_horas?: number | null
          medicacao_suspender?: string | null
          nome?: string
          observacoes_especiais?: string | null
          observacoes_valor?: string | null
          restricoes_alimentares?: string | null
          valor_convenio?: number | null
          valor_particular?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aprovado_por: string | null
          ativo: boolean | null
          created_at: string | null
          data_aprovacao: string | null
          email: string
          id: string
          nome: string
          role: string
          status: string
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          aprovado_por?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_aprovacao?: string | null
          email: string
          id?: string
          nome: string
          role?: string
          status?: string
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          aprovado_por?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_aprovacao?: string | null
          email?: string
          id?: string
          nome?: string
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "vw_usuarios_pendentes"
            referencedColumns: ["id"]
          },
        ]
      }
      questionario_pre_colonoscopia: {
        Row: {
          id: string
          obrigatorio: boolean | null
          opcoes: string[] | null
          ordem: number | null
          pergunta: string
          tipo_resposta: string | null
        }
        Insert: {
          id?: string
          obrigatorio?: boolean | null
          opcoes?: string[] | null
          ordem?: number | null
          pergunta: string
          tipo_resposta?: string | null
        }
        Update: {
          id?: string
          obrigatorio?: boolean | null
          opcoes?: string[] | null
          ordem?: number | null
          pergunta?: string
          tipo_resposta?: string | null
        }
        Relationships: []
      }
      system_backups: {
        Row: {
          backup_type: string
          config: Json | null
          created_at: string | null
          data_size: number | null
          error_message: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          status: string
          table_count: number | null
        }
        Insert: {
          backup_type: string
          config?: Json | null
          created_at?: string | null
          data_size?: number | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          status: string
          table_count?: number | null
        }
        Update: {
          backup_type?: string
          config?: Json | null
          created_at?: string | null
          data_size?: number | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string
          table_count?: number | null
        }
        Relationships: []
      }
      system_health: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          metric_name: string
          metric_unit: string | null
          metric_value: number
          timestamp: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          metric_name: string
          metric_unit?: string | null
          metric_value: number
          timestamp?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          metric_name?: string
          metric_unit?: string | null
          metric_value?: number
          timestamp?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          context: string | null
          created_at: string | null
          data: Json | null
          id: string
          level: string
          message: string
          session_id: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          level: string
          message: string
          session_id?: string | null
          timestamp: string
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          level?: string
          message?: string
          session_id?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: []
      }
      validacoes_detalhadas: {
        Row: {
          erro_detalhado: string | null
          fonte_referencia: string | null
          id: string
          log_auditoria_id: string | null
          objeto_validado: Json | null
          regra_aplicada: string | null
          resultado: boolean | null
          tempo_validacao: number | null
          timestamp: string | null
          tipo_validacao: string
          validador: string | null
          valor_encontrado: string | null
          valor_esperado: string | null
        }
        Insert: {
          erro_detalhado?: string | null
          fonte_referencia?: string | null
          id?: string
          log_auditoria_id?: string | null
          objeto_validado?: Json | null
          regra_aplicada?: string | null
          resultado?: boolean | null
          tempo_validacao?: number | null
          timestamp?: string | null
          tipo_validacao: string
          validador?: string | null
          valor_encontrado?: string | null
          valor_esperado?: string | null
        }
        Update: {
          erro_detalhado?: string | null
          fonte_referencia?: string | null
          id?: string
          log_auditoria_id?: string | null
          objeto_validado?: Json | null
          regra_aplicada?: string | null
          resultado?: boolean | null
          tempo_validacao?: number | null
          timestamp?: string | null
          tipo_validacao?: string
          validador?: string | null
          valor_encontrado?: string | null
          valor_esperado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "validacoes_detalhadas_log_auditoria_id_fkey"
            columns: ["log_auditoria_id"]
            isOneToOne: false
            referencedRelation: "logs_auditoria_medica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validacoes_detalhadas_log_auditoria_id_fkey"
            columns: ["log_auditoria_id"]
            isOneToOne: false
            referencedRelation: "vw_auditoria_critica"
            referencedColumns: ["id"]
          },
        ]
      }
      valores_procedimentos: {
        Row: {
          categoria: string
          codigo_procedimento: string | null
          created_at: string | null
          forma_pagamento: string | null
          id: number
          observacoes: string | null
          procedimento: string
          valor_principal: number | null
          valor_unimed_coparticipacao_20: number | null
          valor_unimed_coparticipacao_40: number | null
        }
        Insert: {
          categoria: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento: string
          valor_principal?: number | null
          valor_unimed_coparticipacao_20?: number | null
          valor_unimed_coparticipacao_40?: number | null
        }
        Update: {
          categoria?: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento?: string
          valor_principal?: number | null
          valor_unimed_coparticipacao_20?: number | null
          valor_unimed_coparticipacao_40?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      vw_agente_alertas: {
        Row: {
          categoria: string | null
          chave: string | null
          dados_extras: Json | null
          prioridade: string | null
          valor: string | null
        }
        Insert: {
          categoria?: string | null
          chave?: string | null
          dados_extras?: Json | null
          prioridade?: never
          valor?: string | null
        }
        Update: {
          categoria?: string | null
          chave?: string | null
          dados_extras?: Json | null
          prioridade?: never
          valor?: string | null
        }
        Relationships: []
      }
      vw_agente_convenios: {
        Row: {
          convenio: string | null
          dados_extras: Json | null
          informacao: string | null
          tipo: string | null
        }
        Insert: {
          convenio?: string | null
          dados_extras?: Json | null
          informacao?: never
          tipo?: never
        }
        Update: {
          convenio?: string | null
          dados_extras?: Json | null
          informacao?: never
          tipo?: never
        }
        Relationships: []
      }
      vw_agente_medicos: {
        Row: {
          convenios_aceitos: string[] | null
          convenios_restricoes: Json | null
          coparticipacao_20: number | null
          coparticipacao_40: number | null
          especialidade: string | null
          forma_pagamento: string | null
          horarios: Json | null
          idade_minima: number | null
          medico: string | null
          nome_atendimento: string | null
          obs_atendimento: string | null
          obs_medico: string | null
          tipo_atendimento: string | null
          valor_particular: number | null
        }
        Relationships: []
      }
      vw_agente_preparos: {
        Row: {
          dias_suspensao: number | null
          exame: string | null
          instrucoes: Json | null
          itens_levar: string | null
          jejum_horas: number | null
          medicacao_suspender: string | null
          nome: string | null
          observacoes_especiais: string | null
          restricoes_alimentares: string | null
        }
        Insert: {
          dias_suspensao?: number | null
          exame?: string | null
          instrucoes?: Json | null
          itens_levar?: string | null
          jejum_horas?: number | null
          medicacao_suspender?: string | null
          nome?: string | null
          observacoes_especiais?: string | null
          restricoes_alimentares?: string | null
        }
        Update: {
          dias_suspensao?: number | null
          exame?: string | null
          instrucoes?: Json | null
          itens_levar?: string | null
          jejum_horas?: number | null
          medicacao_suspender?: string | null
          nome?: string | null
          observacoes_especiais?: string | null
          restricoes_alimentares?: string | null
        }
        Relationships: []
      }
      vw_alertas_ativos: {
        Row: {
          categoria_original: string | null
          erro_detectado: string | null
          id: string | null
          minutos_desde_criacao: number | null
          notificado: boolean | null
          pergunta: string | null
          severidade: number | null
          severidade_desc: string | null
          timestamp: string | null
          tipo: string | null
          tipo_pergunta: string | null
          usuario_afetado: string | null
        }
        Relationships: []
      }
      vw_auditoria_critica: {
        Row: {
          alertas_relacionados: number | null
          categoria: string | null
          erros_detectados: Json | null
          hash_resposta: string | null
          id: string | null
          pergunta_original: string | null
          resposta_gerada: string | null
          status_revisao: string | null
          sucesso: boolean | null
          timestamp: string | null
          tipo_pergunta: string | null
          usuario_telefone: string | null
          validacao_passou: boolean | null
          validacoes_detalhes: string[] | null
        }
        Relationships: []
      }
      vw_dashboard_executivo: {
        Row: {
          alertas_hoje: number | null
          interacoes_hoje: number | null
          interacoes_mes: number | null
          interacoes_semana: number | null
          status_sistema: string | null
          taxa_sucesso_hoje: number | null
          taxa_sucesso_mes: number | null
          taxa_sucesso_semana: number | null
          ultima_atualizacao: string | null
        }
        Relationships: []
      }
      vw_exames_combinaveis: {
        Row: {
          atendimento1_id: string | null
          atendimento1_nome: string | null
          atendimento1_tipo: string | null
          atendimento2_id: string | null
          atendimento2_nome: string | null
          atendimento2_tipo: string | null
          compativel: boolean | null
          medico_id: string | null
          medico_nome: string | null
          motivo_compatibilidade: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_metricas_convenios: {
        Row: {
          convenio: string | null
          perc_sem_medicos: number | null
          taxa_acerto: number | null
          total_com_medicos: number | null
          total_corretas: number | null
          total_perguntas_mes: number | null
          total_sem_medicos: number | null
        }
        Relationships: []
      }
      vw_performance_sistema: {
        Row: {
          alertas_gerados: number | null
          categoria: string | null
          data: string | null
          erros: number | null
          sucessos: number | null
          taxa_sucesso: number | null
          tipo_pergunta: string | null
          total_perguntas: number | null
          validacoes_falha: number | null
          validacoes_ok: number | null
        }
        Relationships: []
      }
      vw_relatorio_gerencial: {
        Row: {
          alertas_24h: number | null
          alertas_pendentes: number | null
          interacoes_conversacionais: number | null
          interacoes_criticas: number | null
          interacoes_informativas: number | null
          periodo: string | null
          precisao_critica: number | null
          precisao_informativa: number | null
          status_geral: string | null
          tipo_mais_frequente: string | null
          total_interacoes: number | null
        }
        Relationships: []
      }
      vw_usuarios_pendentes: {
        Row: {
          aprovado_por_nome: string | null
          created_at: string | null
          email: string | null
          id: string | null
          nome: string | null
          role: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aprovar_usuario: {
        Args: { p_user_id: string; p_aprovador_id: string }
        Returns: Json
      }
      buscar_agendamentos_otimizado: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          paciente_id: string
          medico_id: string
          atendimento_id: string
          data_agendamento: string
          hora_agendamento: string
          status: string
          observacoes: string
          created_at: string
          updated_at: string
          criado_por: string
          criado_por_user_id: string
          paciente_nome: string
          paciente_convenio: string
          paciente_celular: string
          medico_nome: string
          medico_especialidade: string
          atendimento_nome: string
          atendimento_tipo: string
        }[]
      }
      cancelar_agendamento_soft: {
        Args: {
          p_agendamento_id: string
          p_cancelado_por: string
          p_cancelado_por_user_id?: string
        }
        Returns: Json
      }
      cleanup_expired_backups: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      confirmar_agendamento: {
        Args: {
          p_agendamento_id: string
          p_confirmado_por: string
          p_confirmado_por_user_id?: string
        }
        Returns: Json
      }
      confirmar_email_usuario_aprovado: {
        Args: { p_user_email: string; p_admin_id: string }
        Returns: Json
      }
      criar_agendamento_atomico: {
        Args: {
          p_nome_completo: string
          p_data_nascimento: string
          p_convenio: string
          p_telefone: string
          p_celular: string
          p_medico_id: string
          p_atendimento_id: string
          p_data_agendamento: string
          p_hora_agendamento: string
          p_observacoes?: string
          p_criado_por?: string
          p_criado_por_user_id?: string
        }
        Returns: Json
      }
      criar_agendamento_multiplo: {
        Args: {
          p_nome_completo: string
          p_data_nascimento: string
          p_convenio: string
          p_telefone: string
          p_celular: string
          p_medico_id: string
          p_atendimento_ids: string[]
          p_data_agendamento: string
          p_hora_agendamento: string
          p_observacoes?: string
          p_criado_por?: string
          p_criado_por_user_id?: string
        }
        Returns: Json
      }
      dashboard_tempo_real: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          user_id: string
          nome: string
          email: string
          role: string
          ativo: boolean
          username: string
          status: string
          created_at: string
          updated_at: string
        }[]
      }
      get_pending_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nome: string
          email: string
          username: string
          role: string
          created_at: string
          aprovado_por_nome: string
        }[]
      }
      get_pending_users_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nome: string
          email: string
          username: string
          role: string
          created_at: string
          aprovado_por_nome: string
        }[]
      }
      get_user_role_safe: {
        Args: { p_user_id: string }
        Returns: string
      }
      is_admin_auditoria: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_safe: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_authenticated_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      log_access_audit: {
        Args: { p_action: string; p_resource: string; p_details?: Json }
        Returns: undefined
      }
      rejeitar_usuario: {
        Args: { p_user_id: string; p_aprovador_id: string }
        Returns: Json
      }
      relatorio_auditoria_periodo: {
        Args: { data_inicio: string; data_fim: string }
        Returns: {
          total_interacoes: number
          taxa_sucesso: number
          total_alertas: number
          perguntas_criticas: number
          tempo_medio: number
          erros_por_tipo: Json
        }[]
      }
      user_can_access_system: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
