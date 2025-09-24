import { Patient } from './scheduling';

// Tipo para representar um paciente consolidado com múltiplos convênios
export interface ConsolidatedPatient {
  id: string; // ID do registro mais recente
  nome_completo: string;
  data_nascimento: string;
  telefone?: string;
  celular?: string;
  convenios: PatientConvenio[]; // Lista de convênios disponíveis para este paciente
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

// Função utilitária para consolidar pacientes duplicados
export function consolidatePatients(patients: Patient[]): ConsolidatedPatient[] {
  const consolidated = new Map<string, ConsolidatedPatient>();

  patients.forEach(patient => {
    // Usar nome_completo + data_nascimento como chave única
    const key = `${patient.nome_completo.toLowerCase().trim()}-${patient.data_nascimento}`;
    
    if (consolidated.has(key)) {
      // Paciente já existe, adicionar convênio à lista
      const existing = consolidated.get(key)!;
      
      // Verificar se este convênio já não está na lista
      if (!existing.convenios.some(c => c.convenio === patient.convenio)) {
        existing.convenios.push({
          id: patient.id,
          convenio: patient.convenio,
          created_at: patient.created_at,
          updated_at: patient.updated_at,
        });
        
        // Usar o registro mais recente como base
        if (new Date(patient.updated_at) > new Date(existing.updated_at)) {
          existing.id = patient.id;
          existing.telefone = patient.telefone;
          existing.celular = patient.celular;
          existing.updated_at = patient.updated_at;
        }
      }
    } else {
      // Primeiro registro deste paciente
      consolidated.set(key, {
        id: patient.id,
        nome_completo: patient.nome_completo,
        data_nascimento: patient.data_nascimento,
        telefone: patient.telefone,
        celular: patient.celular,
        convenios: [{
          id: patient.id,
          convenio: patient.convenio,
          created_at: patient.created_at,
          updated_at: patient.updated_at,
        }],
        created_at: patient.created_at,
        updated_at: patient.updated_at,
        cliente_id: patient.cliente_id,
      });
    }
  });

  return Array.from(consolidated.values()).map(patient => ({
    ...patient,
    convenios: patient.convenios.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }));
}

// Função para converter ConsolidatedPatient + PatientConvenio de volta para Patient
export function consolidatedToPatient(consolidated: ConsolidatedPatient, convenio: PatientConvenio): Patient {
  return {
    id: convenio.id, // Usar o ID específico do convênio selecionado
    nome_completo: consolidated.nome_completo,
    data_nascimento: consolidated.data_nascimento,
    telefone: consolidated.telefone,
    celular: consolidated.celular,
    convenio: convenio.convenio,
    created_at: convenio.created_at,
    updated_at: convenio.updated_at,
    cliente_id: consolidated.cliente_id,
  };
}