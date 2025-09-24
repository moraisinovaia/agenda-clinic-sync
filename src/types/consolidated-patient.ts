import { Patient } from './scheduling';

// Tipo para representar um paciente consolidado com último convênio usado em agendamento
export interface ConsolidatedPatient {
  id: string; // ID do registro mais recente
  nome_completo: string;
  data_nascimento: string;
  telefone?: string;
  celular?: string;
  ultimo_convenio: string | null; // Último convênio usado em agendamento
  created_at: string;
  updated_at: string;
  cliente_id: string;
}

export interface PatientConvenio {
  id: string; // ID do registro original do paciente
  convenio: string;
  created_at: string;
  updated_at: string;
}

// Função utilitária para consolidar pacientes com último convênio usado
export function consolidatePatients(patients: Patient[], lastConvenios?: Record<string, string>): ConsolidatedPatient[] {
  const consolidated = new Map<string, ConsolidatedPatient>();

  patients.forEach(patient => {
    // Usar nome_completo + data_nascimento como chave única
    const key = `${patient.nome_completo.toLowerCase().trim()}-${patient.data_nascimento}`;
    
    if (consolidated.has(key)) {
      // Paciente já existe, usar o registro mais recente como base
      const existing = consolidated.get(key)!;
      
      if (new Date(patient.updated_at) > new Date(existing.updated_at)) {
        existing.id = patient.id;
        existing.telefone = patient.telefone;
        existing.celular = patient.celular;
        existing.updated_at = patient.updated_at;
      }
    } else {
      // Primeiro registro deste paciente
      const patientKey = `${patient.nome_completo.toLowerCase().trim()}-${patient.data_nascimento}`;
      const ultimoConvenio = lastConvenios?.[patientKey] || patient.convenio;
      
      consolidated.set(key, {
        id: patient.id,
        nome_completo: patient.nome_completo,
        data_nascimento: patient.data_nascimento,
        telefone: patient.telefone,
        celular: patient.celular,
        ultimo_convenio: ultimoConvenio,
        created_at: patient.created_at,
        updated_at: patient.updated_at,
        cliente_id: patient.cliente_id,
      });
    }
  });

  return Array.from(consolidated.values());
}

// Função para converter ConsolidatedPatient de volta para Patient
export function consolidatedToPatient(consolidated: ConsolidatedPatient): Patient {
  return {
    id: consolidated.id,
    nome_completo: consolidated.nome_completo,
    data_nascimento: consolidated.data_nascimento,
    telefone: consolidated.telefone,
    celular: consolidated.celular,
    convenio: consolidated.ultimo_convenio || '',
    created_at: consolidated.created_at,
    updated_at: consolidated.updated_at,
    cliente_id: consolidated.cliente_id,
  };
}