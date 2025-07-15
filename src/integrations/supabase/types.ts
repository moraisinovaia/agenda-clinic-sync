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
      agendamentos: {
        Row: {
          atendimento_id: string
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
          coparticipacao_20: number | null
          coparticipacao_40: number | null
          created_at: string | null
          forma_pagamento: string | null
          horarios: Json | null
          id: string
          medico_id: string | null
          nome: string
          observacoes: string | null
          restricoes: string | null
          tipo: string
          valor_particular: number | null
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          coparticipacao_20?: number | null
          coparticipacao_40?: number | null
          created_at?: string | null
          forma_pagamento?: string | null
          horarios?: Json | null
          id?: string
          medico_id?: string | null
          nome: string
          observacoes?: string | null
          restricoes?: string | null
          tipo: string
          valor_particular?: number | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          coparticipacao_20?: number | null
          coparticipacao_40?: number | null
          created_at?: string | null
          forma_pagamento?: string | null
          horarios?: Json | null
          id?: string
          medico_id?: string | null
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
          valor_20_pct: number | null
          valor_40_pct: number | null
          valor_principal: number | null
        }
        Insert: {
          categoria: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento: string
          valor_20_pct?: number | null
          valor_40_pct?: number | null
          valor_principal?: number | null
        }
        Update: {
          categoria?: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento?: string
          valor_20_pct?: number | null
          valor_40_pct?: number | null
          valor_principal?: number | null
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
          id: string
          instrucoes: Json | null
          itens_levar: string | null
          jejum_horas: number | null
          medicacao_suspender: string | null
          nome: string
          observacoes_especiais: string | null
          restricoes_alimentares: string | null
        }
        Insert: {
          created_at?: string | null
          dias_suspensao?: number | null
          exame: string
          id?: string
          instrucoes?: Json | null
          itens_levar?: string | null
          jejum_horas?: number | null
          medicacao_suspender?: string | null
          nome: string
          observacoes_especiais?: string | null
          restricoes_alimentares?: string | null
        }
        Update: {
          created_at?: string | null
          dias_suspensao?: number | null
          exame?: string
          id?: string
          instrucoes?: Json | null
          itens_levar?: string | null
          jejum_horas?: number | null
          medicacao_suspender?: string | null
          nome?: string
          observacoes_especiais?: string | null
          restricoes_alimentares?: string | null
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
      valores_procedimentos: {
        Row: {
          categoria: string
          codigo_procedimento: string | null
          created_at: string | null
          forma_pagamento: string | null
          id: number
          observacoes: string | null
          procedimento: string
          valor_20_pct: number | null
          valor_40_pct: number | null
          valor_principal: number | null
        }
        Insert: {
          categoria: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento: string
          valor_20_pct?: number | null
          valor_40_pct?: number | null
          valor_principal?: number | null
        }
        Update: {
          categoria?: string
          codigo_procedimento?: string | null
          created_at?: string | null
          forma_pagamento?: string | null
          id?: number
          observacoes?: string | null
          procedimento?: string
          valor_20_pct?: number | null
          valor_40_pct?: number | null
          valor_principal?: number | null
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
          created_at: string
          updated_at: string
        }[]
      }
      rejeitar_usuario: {
        Args: { p_user_id: string; p_aprovador_id: string }
        Returns: Json
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
