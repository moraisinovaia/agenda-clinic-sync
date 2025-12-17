import { useMemo } from 'react';

export interface HealthCheckItem {
  id: string;
  label: string;
  description: string;
  category: 'config' | 'data' | 'integration' | 'operational';
  weight: number;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
}

export interface ClinicHealthData {
  id: string;
  nome: string;
  ativo: boolean;
  created_at?: string;
  doctors_count: number;
  patients_count: number;
  total_appointments: number;
  future_appointments: number;
  today_appointments: number;
  users_count: number;
  last_7_days_appointments?: Array<{ date: string; count: number }>;
  // Extended data for health checks
  has_contact_info?: boolean;
  has_llm_config?: boolean;
  has_business_rules?: boolean;
  has_services?: boolean;
  has_schedule_config?: boolean;
  whatsapp?: string;
  telefone?: string;
  endereco?: string;
  // Real data metrics
  services_count?: number;
  schedule_count?: number;
  last_7_days_count?: number;
  last_30_days_count?: number;
  is_active_recently?: boolean;
}

export interface HealthScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  color: string;
  checks: HealthCheckItem[];
  passedCount: number;
  totalCount: number;
  criticalIssues: HealthCheckItem[];
  warnings: HealthCheckItem[];
}

export function calculateHealthScore(clinic: ClinicHealthData): HealthScoreResult {
  const checks: HealthCheckItem[] = [
    // Configuration checks (40%)
    {
      id: 'has_doctors',
      label: 'Médicos cadastrados',
      description: 'Pelo menos 1 médico ativo cadastrado',
      category: 'config',
      weight: 15,
      passed: clinic.doctors_count > 0,
      severity: 'critical'
    },
    {
      id: 'has_services',
      label: 'Serviços configurados',
      description: clinic.services_count !== undefined 
        ? `${clinic.services_count} serviços ativos` 
        : 'Atendimentos/exames cadastrados',
      category: 'config',
      weight: 10,
      passed: (clinic.services_count ?? 0) > 0 || clinic.has_services !== false,
      severity: 'critical'
    },
    {
      id: 'has_contact',
      label: 'Informações de contato',
      description: 'Telefone ou WhatsApp configurado',
      category: 'config',
      weight: 10,
      passed: !!(clinic.whatsapp || clinic.telefone || clinic.has_contact_info),
      severity: 'warning'
    },
    {
      id: 'has_address',
      label: 'Endereço configurado',
      description: 'Endereço da clínica preenchido',
      category: 'config',
      weight: 5,
      passed: !!(clinic.endereco),
      severity: 'info'
    },

    // Data checks (25%)
    {
      id: 'has_patients',
      label: 'Base de pacientes',
      description: 'Pacientes cadastrados no sistema',
      category: 'data',
      weight: 10,
      passed: clinic.patients_count > 0,
      severity: 'warning'
    },
    {
      id: 'has_users',
      label: 'Usuários ativos',
      description: 'Equipe com acesso ao sistema',
      category: 'data',
      weight: 10,
      passed: clinic.users_count > 0,
      severity: 'warning'
    },
    {
      id: 'has_appointments',
      label: 'Histórico de agendamentos',
      description: 'Agendamentos realizados',
      category: 'data',
      weight: 5,
      passed: clinic.total_appointments > 0,
      severity: 'info'
    },

    // Integration checks (20%)
    {
      id: 'has_llm_config',
      label: 'LLM API configurada',
      description: 'Integração com agente de IA',
      category: 'integration',
      weight: 10,
      passed: clinic.has_llm_config !== false,
      severity: 'warning'
    },
    {
      id: 'has_business_rules',
      label: 'Regras de negócio',
      description: 'Regras de agendamento configuradas',
      category: 'integration',
      weight: 10,
      passed: clinic.has_business_rules !== false,
      severity: 'warning'
    },

    // Operational checks (15%)
    {
      id: 'is_active',
      label: 'Clínica ativa',
      description: 'Status ativo no sistema',
      category: 'operational',
      weight: 5,
      passed: clinic.ativo,
      severity: 'critical'
    },
    {
      id: 'has_future_appointments',
      label: 'Agenda com movimento',
      description: 'Agendamentos futuros programados',
      category: 'operational',
      weight: 5,
      passed: clinic.future_appointments > 0,
      severity: 'info'
    },
    {
      id: 'has_schedule_config',
      label: 'Horários configurados',
      description: clinic.schedule_count !== undefined 
        ? `${clinic.schedule_count} configurações ativas` 
        : 'Configuração de horários dos médicos',
      category: 'operational',
      weight: 5,
      passed: (clinic.schedule_count ?? 0) > 0 || clinic.has_schedule_config !== false,
      severity: 'warning'
    },
    {
      id: 'has_recent_activity',
      label: 'Atividade recente',
      description: clinic.last_7_days_count !== undefined 
        ? `${clinic.last_7_days_count} agendamentos nos últimos 7 dias` 
        : 'Agendamentos nos últimos 7 dias',
      category: 'operational',
      weight: 5,
      passed: (clinic.last_7_days_count ?? 0) > 0 || clinic.is_active_recently === true,
      severity: 'warning'
    }
  ];

  const passedChecks = checks.filter(c => c.passed);
  const passedCount = passedChecks.length;
  const totalCount = checks.length;
  
  // Calculate weighted score
  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedScore = passedChecks.reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round((earnedScore / maxScore) * 100);

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let color: string;
  
  if (score >= 90) {
    grade = 'A';
    color = '#10B981'; // green
  } else if (score >= 75) {
    grade = 'B';
    color = '#3B82F6'; // blue
  } else if (score >= 60) {
    grade = 'C';
    color = '#F59E0B'; // yellow/orange
  } else if (score >= 40) {
    grade = 'D';
    color = '#F97316'; // orange
  } else {
    grade = 'F';
    color = '#EF4444'; // red
  }

  const criticalIssues = checks.filter(c => !c.passed && c.severity === 'critical');
  const warnings = checks.filter(c => !c.passed && c.severity === 'warning');

  return {
    score,
    grade,
    color,
    checks,
    passedCount,
    totalCount,
    criticalIssues,
    warnings
  };
}

export function useClinicHealthScore(clinic: ClinicHealthData | null) {
  return useMemo(() => {
    if (!clinic) return null;
    return calculateHealthScore(clinic);
  }, [clinic]);
}

export function useMultiClinicHealthScores(clinics: ClinicHealthData[]) {
  return useMemo(() => {
    return clinics.map(clinic => ({
      clinic,
      health: calculateHealthScore(clinic)
    }));
  }, [clinics]);
}
