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
          alterado_por_user_id: string | null
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
          excluido_em: string | null
          excluido_por: string | null
          excluido_por_user_id: string | null
          hora_agendamento: string
          id: string
          medico_id: string
          observacoes: string | null
          paciente_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alterado_por_user_id?: string | null
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
          excluido_em?: string | null
          excluido_por?: string | null
          excluido_por_user_id?: string | null
          hora_agendamento: string
          id?: string
          medico_id: string
          observacoes?: string | null
          paciente_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alterado_por_user_id?: string | null
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
          excluido_em?: string | null
          excluido_por?: string | null
          excluido_por_user_id?: string | null
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
      audit_logs: {
        Row: {
          action: string
          audit_timestamp: string
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string
          session_info: Json | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          audit_timestamp?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          session_info?: Json | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          audit_timestamp?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          session_info?: Json | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      confirmacoes_automaticas: {
        Row: {
          acao_tomada: string | null
          agendamento_id: string
          cliente_id: string
          created_at: string | null
          data_envio: string | null
          id: string
          mensagem_enviada: string | null
          processado_em: string | null
          resposta_paciente: string | null
          resposta_recebida_em: string | null
          tentativas: number | null
          tipo_notificacao: string
          updated_at: string | null
        }
        Insert: {
          acao_tomada?: string | null
          agendamento_id: string
          cliente_id: string
          created_at?: string | null
          data_envio?: string | null
          id?: string
          mensagem_enviada?: string | null
          processado_em?: string | null
          resposta_paciente?: string | null
          resposta_recebida_em?: string | null
          tentativas?: number | null
          tipo_notificacao: string
          updated_at?: string | null
        }
        Update: {
          acao_tomada?: string | null
          agendamento_id?: string
          cliente_id?: string
          created_at?: string | null
          data_envio?: string | null
          id?: string
          mensagem_enviada?: string | null
          processado_em?: string | null
          resposta_paciente?: string | null
          resposta_recebida_em?: string | null
          tentativas?: number | null
          tipo_notificacao?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confirmacoes_automaticas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmacoes_automaticas_cliente_id_fkey"
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
      horarios_configuracao: {
        Row: {
          ativo: boolean | null
          cliente_id: string
          created_at: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          intervalo_minutos: number | null
          medico_id: string
          periodo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cliente_id: string
          created_at?: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          intervalo_minutos?: number | null
          medico_id: string
          periodo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cliente_id?: string
          created_at?: string | null
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          intervalo_minutos?: number | null
          medico_id?: string
          periodo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horarios_configuracao_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_configuracao_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_vazios: {
        Row: {
          cliente_id: string
          created_at: string | null
          data: string
          hora: string
          id: string
          medico_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          data: string
          hora: string
          id?: string
          medico_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          data?: string
          hora?: string
          id?: string
          medico_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "horarios_vazios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_vazios_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
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
          data_nascimento: string | null
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
          data_nascimento?: string | null
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
          data_nascimento?: string | null
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
          cargo: string | null
          cliente_id: string | null
          created_at: string | null
          data_aprovacao: string | null
          email: string
          id: string
          nome: string
          status: string
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          aprovado_por?: string | null
          ativo?: boolean | null
          cargo?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          email: string
          id?: string
          nome: string
          status?: string
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          aprovado_por?: string | null
          ativo?: boolean | null
          cargo?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_aprovacao?: string | null
          email?: string
          id?: string
          nome?: string
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
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
        Args: { p_aprovador_user_id: string; p_user_id: string }
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
      buscar_agendamentos_otimizado: {
        Args: {
          p_data_fim?: string
          p_data_inicio?: string
          p_medico_id?: string
          p_status?: string
        }
        Returns: Json[]
      }
      buscar_agendamentos_otimizado_ipado: {
        Args: never
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
      bytea_to_text: { Args: { data: string }; Returns: string }
      cancelar_agendamento_soft: {
        Args: {
          p_agendamento_id: string
          p_cancelado_por: string
          p_cancelado_por_user_id?: string
        }
        Returns: Json
      }
      check_security_health: { Args: never; Returns: Json }
      cleanup_expired_backups: { Args: never; Returns: undefined }
      cleanup_expired_horarios_vazios: { Args: never; Returns: undefined }
      cleanup_expired_slots: { Args: never; Returns: undefined }
      cleanup_old_backups_auto: { Args: never; Returns: undefined }
      cleanup_old_logs: { Args: never; Returns: undefined }
      cleanup_old_security_logs: { Args: never; Returns: undefined }
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
        Args: {
          p_agendamento_id_edicao?: string
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
      criar_agendamento_atomico_externo: {
        Args: {
          p_atendimento_id: string
          p_celular: string
          p_cliente_id: string
          p_convenio: string
          p_criado_por?: string
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
      criar_cliente_ipado: { Args: never; Returns: Json }
      criar_perfil_admin_orfao: {
        Args: {
          p_admin_id?: string
          p_nome: string
          p_role?: string
          p_user_id: string
        }
        Returns: Json
      }
      criar_usuario_teste_ipado: { Args: never; Returns: Json }
      debug_user_access: { Args: never; Returns: Json }
      desconfirmar_agendamento: {
        Args: {
          p_agendamento_id: string
          p_desconfirmado_por: string
          p_desconfirmado_por_user_id?: string
        }
        Returns: Json
      }
      diagnosticar_whatsapp_sistema: { Args: never; Returns: Json }
      ensure_user_cliente_id: { Args: never; Returns: undefined }
      enviar_whatsapp_fallback: {
        Args: { p_agendamento_id: string }
        Returns: Json
      }
      enviar_whatsapp_via_invoke: {
        Args: { p_agendamento_id: string }
        Returns: Json
      }
      excluir_agendamento_soft: {
        Args: {
          p_agendamento_id: string
          p_excluido_por: string
          p_excluido_por_user_id?: string
        }
        Returns: Json
      }
      excluir_usuario: {
        Args: { p_admin_id: string; p_user_id: string }
        Returns: Json
      }
      get_agendamento_audit_history: {
        Args: { p_agendamento_id: string }
        Returns: {
          action: string
          audit_timestamp: string
          changed_fields: string[]
          id: string
          new_values: Json
          old_values: Json
          profile_name: string
          user_name: string
        }[]
      }
      get_approved_users_safe: {
        Args: never
        Returns: {
          cargo: string
          created_at: string
          data_aprovacao: string
          email: string
          id: string
          nome: string
          status: string
          username: string
        }[]
      }
      get_backup_cron_status: {
        Args: never
        Returns: {
          active: boolean
          job_name: string
          schedule: string
        }[]
      }
      get_clientes_admin: {
        Args: never
        Returns: {
          ativo: boolean
          id: string
          nome: string
        }[]
      }
      get_current_user_profile: {
        Args: never
        Returns: {
          ativo: boolean
          cliente_id: string
          created_at: string
          email: string
          id: string
          nome: string
          status: string
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      get_email_by_username: { Args: { p_username: string }; Returns: string }
      get_pending_users: {
        Args: never
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
        Args: never
        Returns: {
          cargo: string
          created_at: string
          email: string
          id: string
          nome: string
          username: string
        }[]
      }
      get_profile_auth_id: { Args: { p_profile_id: string }; Returns: Json }
      get_user_cliente_id: { Args: never; Returns: string }
      get_user_role_safe: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_admin_safe: { Args: never; Returns: boolean }
      is_admin_user: { Args: never; Returns: boolean }
      is_admin_with_user_id: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      listar_usuarios_orfaos: {
        Args: never
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
      log_security_event: {
        Args: {
          event_description: string
          event_type: string
          user_context?: Json
        }
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
      prepare_production_deploy: { Args: never; Returns: Json }
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
        Args: { p_aprovador_user_id: string; p_user_id: string }
        Returns: Json
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
      text_to_bytea: { Args: { data: string }; Returns: string }
      toggle_backup_cron: { Args: { enable_cron: boolean }; Returns: boolean }
      update_client_metrics: { Args: never; Returns: undefined }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      user_can_access_system: { Args: never; Returns: boolean }
      validar_conflito_agendamento: {
        Args: {
          p_agendamento_id_edicao?: string
          p_data_agendamento: string
          p_hora_agendamento: string
          p_medico_id: string
        }
        Returns: Json
      }
      validate_production_security: { Args: never; Returns: Json }
      validate_system_health: { Args: never; Returns: Json }
      verificar_status_email: { Args: { p_email: string }; Returns: Json }
      verify_admin_access: { Args: { p_profile_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "recepcionista" | "medico"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
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
    Enums: {
      app_role: ["admin", "recepcionista", "medico"],
    },
  },
} as const
