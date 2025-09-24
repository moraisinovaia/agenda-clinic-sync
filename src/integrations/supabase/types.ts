export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          atendimento_id: string
          cancelado_em: string | null
          cancelado_por: string | null
          cancelado_por_user_id: string | null
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
      atendimentos: {
        Row: {
          ativo: boolean | null
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
          {
            foreignKeyName: "fk_atendimentos_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_agenda: {
        Row: {
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
        Relationships: [
          {
            foreignKeyName: "fk_bloqueios_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          ativo: boolean | null
          configuracoes: Json | null
          created_at: string | null
          id: string
          logo_url: string | null
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          configuracoes?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          configuracoes?: Json | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      configuracoes_clinica: {
        Row: {
          ativo: boolean | null
          categoria: string
          chave: string
          cliente_id: string | null
          created_at: string | null
          dados_extras: Json | null
          id: string
          updated_at: string | null
          valor: string
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          chave: string
          cliente_id?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          updated_at?: string | null
          valor: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          chave?: string
          cliente_id?: string | null
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          updated_at?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_clinica_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      endogastro_agendamentos: {
        Row: {
          agendamento_id_original: string
          atendimento_id: string
          cancelado_em: string | null
          cancelado_por: string | null
          cancelado_por_user_id: string | null
          cliente_id: string
          confirmado_em: string | null
          confirmado_por: string | null
          confirmado_por_user_id: string | null
          convenio: string | null
          created_at: string | null
          criado_por: string | null
          criado_por_user_id: string | null
          data_agendamento: string
          hora_agendamento: string
          id: string
          medico_id: string
          migrado_em: string | null
          motivo_migracao: string | null
          observacoes: string | null
          paciente_id: string
          sistema_origem: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agendamento_id_original: string
          atendimento_id: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelado_por_user_id?: string | null
          cliente_id: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          confirmado_por_user_id?: string | null
          convenio?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_user_id?: string | null
          data_agendamento: string
          hora_agendamento: string
          id?: string
          medico_id: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          observacoes?: string | null
          paciente_id: string
          sistema_origem?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agendamento_id_original?: string
          atendimento_id?: string
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelado_por_user_id?: string | null
          cliente_id?: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          confirmado_por_user_id?: string | null
          convenio?: string | null
          created_at?: string | null
          criado_por?: string | null
          criado_por_user_id?: string | null
          data_agendamento?: string
          hora_agendamento?: string
          id?: string
          medico_id?: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          observacoes?: string | null
          paciente_id?: string
          sistema_origem?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      endogastro_bloqueios_agenda: {
        Row: {
          bloqueio_id_original: string
          cliente_id: string
          created_at: string | null
          criado_por: string | null
          criado_por_user_id: string | null
          data_fim: string
          data_inicio: string
          id: string
          medico_id: string
          migrado_em: string | null
          motivo: string
          motivo_migracao: string | null
          sistema_origem: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          bloqueio_id_original: string
          cliente_id: string
          created_at?: string | null
          criado_por?: string | null
          criado_por_user_id?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          medico_id: string
          migrado_em?: string | null
          motivo: string
          motivo_migracao?: string | null
          sistema_origem?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          bloqueio_id_original?: string
          cliente_id?: string
          created_at?: string | null
          criado_por?: string | null
          criado_por_user_id?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          medico_id?: string
          migrado_em?: string | null
          motivo?: string
          motivo_migracao?: string | null
          sistema_origem?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      endogastro_fila_espera: {
        Row: {
          agendamento_id: string | null
          atendimento_id: string
          cliente_id: string
          created_at: string | null
          data_limite: string | null
          data_preferida: string
          fila_id_original: string
          id: string
          medico_id: string
          migrado_em: string | null
          motivo_migracao: string | null
          observacoes: string | null
          paciente_id: string
          periodo_preferido: string | null
          prioridade: number | null
          sistema_origem: string | null
          status: string | null
          tentativas_contato: number | null
          ultimo_contato: string | null
          updated_at: string | null
        }
        Insert: {
          agendamento_id?: string | null
          atendimento_id: string
          cliente_id: string
          created_at?: string | null
          data_limite?: string | null
          data_preferida: string
          fila_id_original: string
          id?: string
          medico_id: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          observacoes?: string | null
          paciente_id: string
          periodo_preferido?: string | null
          prioridade?: number | null
          sistema_origem?: string | null
          status?: string | null
          tentativas_contato?: number | null
          ultimo_contato?: string | null
          updated_at?: string | null
        }
        Update: {
          agendamento_id?: string | null
          atendimento_id?: string
          cliente_id?: string
          created_at?: string | null
          data_limite?: string | null
          data_preferida?: string
          fila_id_original?: string
          id?: string
          medico_id?: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          observacoes?: string | null
          paciente_id?: string
          periodo_preferido?: string | null
          prioridade?: number | null
          sistema_origem?: string | null
          status?: string | null
          tentativas_contato?: number | null
          ultimo_contato?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      endogastro_medicos: {
        Row: {
          ativo: boolean | null
          cliente_id: string
          convenios_aceitos: string[] | null
          convenios_restricoes: Json | null
          created_at: string | null
          especialidade: string
          horarios: Json | null
          id: string
          idade_maxima: number | null
          idade_minima: number | null
          medico_id_original: string
          migrado_em: string | null
          motivo_migracao: string | null
          nome: string
          observacoes: string | null
          sistema_origem: string | null
        }
        Insert: {
          ativo?: boolean | null
          cliente_id: string
          convenios_aceitos?: string[] | null
          convenios_restricoes?: Json | null
          created_at?: string | null
          especialidade: string
          horarios?: Json | null
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          medico_id_original: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          nome: string
          observacoes?: string | null
          sistema_origem?: string | null
        }
        Update: {
          ativo?: boolean | null
          cliente_id?: string
          convenios_aceitos?: string[] | null
          convenios_restricoes?: Json | null
          created_at?: string | null
          especialidade?: string
          horarios?: Json | null
          id?: string
          idade_maxima?: number | null
          idade_minima?: number | null
          medico_id_original?: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          nome?: string
          observacoes?: string | null
          sistema_origem?: string | null
        }
        Relationships: []
      }
      endogastro_pacientes: {
        Row: {
          celular: string | null
          cliente_id: string
          convenio: string
          created_at: string | null
          data_nascimento: string
          id: string
          migrado_em: string | null
          motivo_migracao: string | null
          nome_completo: string
          paciente_id_original: string
          sistema_origem: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          celular?: string | null
          cliente_id: string
          convenio: string
          created_at?: string | null
          data_nascimento: string
          id?: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          nome_completo: string
          paciente_id_original: string
          sistema_origem?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          celular?: string | null
          cliente_id?: string
          convenio?: string
          created_at?: string | null
          data_nascimento?: string
          id?: string
          migrado_em?: string | null
          motivo_migracao?: string | null
          nome_completo?: string
          paciente_id_original?: string
          sistema_origem?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fila_espera: {
        Row: {
          agendamento_id: string | null
          atendimento_id: string
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            foreignKeyName: "fk_fila_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
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
      medicos: {
        Row: {
          ativo: boolean | null
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
        Relationships: [
          {
            foreignKeyName: "fk_medicos_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          agendamento_id: string
          created_at: string | null
          error_message: string | null
          id: string
          is_for_staff: boolean | null
          message: string
          recipient: string
          sent_at: string | null
          status: string | null
          type: string
        }
        Insert: {
          agendamento_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          is_for_staff?: boolean | null
          message: string
          recipient: string
          sent_at?: string | null
          status?: string | null
          type: string
        }
        Update: {
          agendamento_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          is_for_staff?: boolean | null
          message?: string
          recipient?: string
          sent_at?: string | null
          status?: string | null
          type?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          celular: string | null
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
          convenio?: string
          created_at?: string
          data_nascimento?: string
          id?: string
          nome_completo?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pacientes_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      preparos: {
        Row: {
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
        Relationships: [
          {
            foreignKeyName: "fk_preparos_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aprovado_por: string | null
          ativo: boolean | null
          cliente_id: string | null
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
          cliente_id?: string | null
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
          cliente_id?: string | null
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
            foreignKeyName: "fk_profiles_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      system_settings: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          editable: boolean | null
          id: string
          key: string
          type: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          editable?: boolean | null
          id?: string
          key: string
          type?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          editable?: boolean | null
          id?: string
          key?: string
          type?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      temp_medicos_backup: {
        Row: {
          ativo: boolean | null
          cliente_id: string | null
          convenios_aceitos: string[] | null
          convenios_restricoes: Json | null
          created_at: string | null
          especialidade: string | null
          horarios: Json | null
          id: string | null
          idade_maxima: number | null
          idade_minima: number | null
          nome: string | null
          observacoes: string | null
        }
        Insert: {
          ativo?: boolean | null
          cliente_id?: string | null
          convenios_aceitos?: string[] | null
          convenios_restricoes?: Json | null
          created_at?: string | null
          especialidade?: string | null
          horarios?: Json | null
          id?: string | null
          idade_maxima?: number | null
          idade_minima?: number | null
          nome?: string | null
          observacoes?: string | null
        }
        Update: {
          ativo?: boolean | null
          cliente_id?: string | null
          convenios_aceitos?: string[] | null
          convenios_restricoes?: Json | null
          created_at?: string | null
          especialidade?: string | null
          horarios?: Json | null
          id?: string | null
          idade_maxima?: number | null
          idade_minima?: number | null
          nome?: string | null
          observacoes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_historico_endogastro: {
        Row: {
          agendamento_criado_em: string | null
          agendamento_id: string | null
          convenio: string | null
          data_agendamento: string | null
          hora_agendamento: string | null
          medico_especialidade: string | null
          medico_nome: string | null
          migrado_em: string | null
          observacoes: string | null
          paciente_celular: string | null
          paciente_nascimento: string | null
          paciente_nome: string | null
          sistema_origem: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aprovar_usuario: {
        Args:
          | { p_aprovador_id: string; p_cliente_id: string; p_user_id: string }
          | { p_aprovador_id: string; p_user_id: string }
        Returns: Json
      }
      atualizar_cliente_usuario: {
        Args: {
          p_admin_id?: string
          p_novo_cliente_id: string
          p_user_email: string
        }
        Returns: Json
      }
      atualizar_dados_paciente: {
        Args: {
          p_celular?: string
          p_convenio: string
          p_data_nascimento: string
          p_nome_completo: string
          p_paciente_id: string
          p_telefone?: string
        }
        Returns: Json
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      buscar_agendamentos_otimizado: {
        Args: Record<PropertyKey, never>
        Returns: {
          atendimento_id: string
          atendimento_nome: string
          atendimento_tipo: string
          cancelado_em: string
          cancelado_por: string
          cancelado_por_user_id: string
          confirmado_em: string
          confirmado_por: string
          confirmado_por_user_id: string
          convenio: string
          created_at: string
          criado_por: string
          criado_por_user_id: string
          data_agendamento: string
          hora_agendamento: string
          id: string
          medico_especialidade: string
          medico_id: string
          medico_nome: string
          observacoes: string
          paciente_celular: string
          paciente_convenio: string
          paciente_data_nascimento: string
          paciente_id: string
          paciente_nome: string
          paciente_telefone: string
          status: string
          updated_at: string
        }[]
      }
      buscar_agendamentos_otimizado_ipado: {
        Args: Record<PropertyKey, never>
        Returns: {
          atendimento_id: string
          atendimento_nome: string
          atendimento_tipo: string
          created_at: string
          criado_por: string
          criado_por_user_id: string
          data_agendamento: string
          hora_agendamento: string
          id: string
          medico_especialidade: string
          medico_id: string
          medico_nome: string
          observacoes: string
          paciente_celular: string
          paciente_convenio: string
          paciente_data_nascimento: string
          paciente_id: string
          paciente_nome: string
          paciente_telefone: string
          status: string
          updated_at: string
        }[]
      }
      buscar_historico_endogastro: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_medico_nome?: string
          p_paciente_nome?: string
        }
        Returns: {
          agendamento_id: string
          convenio: string
          data_agendamento: string
          especialidade: string
          hora_agendamento: string
          medico_nome: string
          migrado_em: string
          observacoes: string
          paciente_nome: string
          status: string
        }[]
      }
      bytea_to_text: {
        Args: { data: string }
        Returns: string
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
      cleanup_old_backups_auto: {
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
        Args: { p_admin_id: string; p_user_email: string }
        Returns: Json
      }
      criar_agendamento_atomico: {
        Args:
          | {
              p_agendamento_id_edicao?: string
              p_atendimento_id: string
              p_celular: string
              p_convenio: string
              p_criado_por?: string
              p_criado_por_user_id?: string
              p_data_agendamento: string
              p_data_nascimento: string
              p_force_conflict?: boolean
              p_force_update_patient?: boolean
              p_hora_agendamento: string
              p_medico_id: string
              p_nome_completo: string
              p_observacoes?: string
              p_telefone: string
            }
          | {
              p_agendamento_id_edicao?: string
              p_atendimento_id: string
              p_celular: string
              p_convenio: string
              p_criado_por?: string
              p_criado_por_user_id?: string
              p_data_agendamento: string
              p_data_nascimento: string
              p_force_update_patient?: boolean
              p_hora_agendamento: string
              p_medico_id: string
              p_nome_completo: string
              p_observacoes?: string
              p_telefone: string
            }
        Returns: Json
      }
      criar_agendamento_atomico_ipado: {
        Args: {
          p_atendimento_id: string
          p_celular: string
          p_convenio: string
          p_criado_por?: string
          p_criado_por_user_id?: string
          p_data_agendamento: string
          p_data_nascimento: string
          p_force_conflict?: boolean
          p_hora_agendamento: string
          p_medico_id: string
          p_nome_completo: string
          p_observacoes?: string
          p_telefone: string
        }
        Returns: Json
      }
      criar_agendamento_multiplo: {
        Args: {
          p_atendimento_ids: string[]
          p_celular: string
          p_convenio: string
          p_criado_por?: string
          p_criado_por_user_id?: string
          p_data_agendamento: string
          p_data_nascimento: string
          p_hora_agendamento: string
          p_medico_id: string
          p_nome_completo: string
          p_observacoes?: string
          p_telefone: string
        }
        Returns: Json
      }
      criar_cliente_ipado: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      criar_perfil_admin_orfao: {
        Args: {
          p_admin_id?: string
          p_nome: string
          p_role?: string
          p_user_id: string
        }
        Returns: Json
      }
      criar_usuario_teste_ipado: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      debug_user_access: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      desconfirmar_agendamento: {
        Args: {
          p_agendamento_id: string
          p_desconfirmado_por: string
          p_desconfirmado_por_user_id?: string
        }
        Returns: Json
      }
      diagnosticar_whatsapp_sistema: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      enviar_whatsapp_fallback: {
        Args: { p_agendamento_id: string }
        Returns: Json
      }
      enviar_whatsapp_via_invoke: {
        Args: { p_agendamento_id: string }
        Returns: Json
      }
      get_approved_users_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          data_aprovacao: string
          email: string
          email_confirmed: boolean
          id: string
          nome: string
          role: string
          status: string
          user_id: string
          username: string
        }[]
      }
      get_backup_cron_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          job_name: string
          schedule: string
        }[]
      }
      get_clientes_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          ativo: boolean
          id: string
          nome: string
        }[]
      }
      get_current_user_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          ativo: boolean
          cliente_id: string
          created_at: string
          email: string
          id: string
          nome: string
          role: string
          status: string
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      get_email_by_username: {
        Args: { p_username: string }
        Returns: string
      }
      get_pending_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          aprovado_por_nome: string
          created_at: string
          email: string
          id: string
          nome: string
          role: string
          user_id: string
          username: string
        }[]
      }
      get_pending_users_safe: {
        Args: Record<PropertyKey, never>
        Returns: {
          aprovado_por_nome: string
          created_at: string
          email: string
          id: string
          nome: string
          role: string
          username: string
        }[]
      }
      get_user_cliente_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role_safe: {
        Args: { p_user_id: string }
        Returns: string
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { data: Json; uri: string } | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_admin_safe: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_with_user_id: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      listar_usuarios_orfaos: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          email_confirmed_at: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      log_access_audit: {
        Args: { p_action: string; p_details?: Json; p_resource: string }
        Returns: undefined
      }
      log_super_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_client_id?: string
          p_target_user_id?: string
        }
        Returns: string
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      recuperar_usuario_orfao: {
        Args: {
          p_admin_id?: string
          p_cliente_id?: string
          p_email: string
          p_nome: string
          p_role?: string
        }
        Returns: Json
      }
      rejeitar_usuario: {
        Args: { p_aprovador_id: string; p_user_id: string }
        Returns: Json
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      test_whatsapp_edge_function: {
        Args: {
          p_atendimento?: string
          p_celular: string
          p_data?: string
          p_hora?: string
          p_medico?: string
          p_nome?: string
        }
        Returns: Json
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      toggle_backup_cron: {
        Args: { enable_cron: boolean }
        Returns: boolean
      }
      update_client_metrics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
      user_can_access_system: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      validar_conflito_agendamento: {
        Args: {
          p_agendamento_id_edicao?: string
          p_data_agendamento: string
          p_hora_agendamento: string
          p_medico_id: string
        }
        Returns: Json
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      verificar_status_email: {
        Args: { p_email: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
