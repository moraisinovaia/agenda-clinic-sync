// Tipos específicos para o sistema de onboarding

export interface OnboardingClinicaData {
  nome: string;
  logo_url?: string;
  configuracoes: {
    horario_funcionamento: {
      inicio: string;
      fim: string;
    };
    dias_funcionamento: string[];
  };
}

export interface OnboardingAdminData {
  nome: string;
  email: string;
  password: string;
  username: string;
}

export interface OnboardingAtendimentoTemplate {
  nome: string;
  tipo: 'consulta' | 'exame' | 'procedimento' | 'tratamento';
  valor_particular: number;
  codigo: string;
}

export interface OnboardingEspecialidadeTemplate {
  medicos_padrao: string[];
  atendimentos: OnboardingAtendimentoTemplate[];
}

export interface OnboardingFormData {
  clinica: OnboardingClinicaData;
  admin: OnboardingAdminData;
  especialidades: string[];
  atendimentos_customizados: any[];
}

export interface OnboardingResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    cliente_id: string;
    admin_id: string;
    medicos_criados: number;
    atendimentos_criados: number;
    especialidades: string[];
  };
}

export interface OnboardingStep {
  id: number;
  title: string;
  icon: any;
  completed?: boolean;
}

export const ONBOARDING_ESPECIALIDADES: Record<string, OnboardingEspecialidadeTemplate> = {
  "Cardiologia": {
    medicos_padrao: ["Dr. João Cardoso"],
    atendimentos: [
      { nome: "Consulta Cardiológica", tipo: "consulta", valor_particular: 200, codigo: "CARD001" },
      { nome: "Ecocardiograma", tipo: "exame", valor_particular: 150, codigo: "CARD002" },
      { nome: "ECG", tipo: "exame", valor_particular: 80, codigo: "CARD003" },
      { nome: "Teste Ergométrico", tipo: "exame", valor_particular: 250, codigo: "CARD004" }
    ]
  },
  "Gastroenterologia": {
    medicos_padrao: ["Dr. Maria Santos"],
    atendimentos: [
      { nome: "Consulta Gastroenterológica", tipo: "consulta", valor_particular: 220, codigo: "GAST001" },
      { nome: "Endoscopia", tipo: "procedimento", valor_particular: 400, codigo: "GAST002" },
      { nome: "Colonoscopia", tipo: "procedimento", valor_particular: 500, codigo: "GAST003" },
      { nome: "Ultrassom Abdominal", tipo: "exame", valor_particular: 120, codigo: "GAST004" }
    ]
  },
  "Dermatologia": {
    medicos_padrao: ["Dra. Ana Silva"],
    atendimentos: [
      { nome: "Consulta Dermatológica", tipo: "consulta", valor_particular: 180, codigo: "DERM001" },
      { nome: "Biópsia", tipo: "procedimento", valor_particular: 300, codigo: "DERM002" },
      { nome: "Cauterização", tipo: "procedimento", valor_particular: 150, codigo: "DERM003" },
      { nome: "Dermatoscopia", tipo: "exame", valor_particular: 100, codigo: "DERM004" }
    ]
  },
  "Ortopedia": {
    medicos_padrao: ["Dr. Carlos Mendes"],
    atendimentos: [
      { nome: "Consulta Ortopédica", tipo: "consulta", valor_particular: 200, codigo: "ORTO001" },
      { nome: "Raio-X", tipo: "exame", valor_particular: 80, codigo: "ORTO002" },
      { nome: "Infiltração", tipo: "procedimento", valor_particular: 250, codigo: "ORTO003" },
      { nome: "Fisioterapia", tipo: "tratamento", valor_particular: 60, codigo: "ORTO004" }
    ]
  },
  "Pediatria": {
    medicos_padrao: ["Dra. Lucia Oliveira"],
    atendimentos: [
      { nome: "Consulta Pediátrica", tipo: "consulta", valor_particular: 160, codigo: "PEDI001" },
      { nome: "Puericultura", tipo: "consulta", valor_particular: 140, codigo: "PEDI002" },
      { nome: "Vacinação", tipo: "procedimento", valor_particular: 50, codigo: "PEDI003" },
      { nome: "Teste do Pezinho", tipo: "exame", valor_particular: 80, codigo: "PEDI004" }
    ]
  },
  "Ginecologia": {
    medicos_padrao: ["Dra. Fernanda Lima"],
    atendimentos: [
      { nome: "Consulta Ginecológica", tipo: "consulta", valor_particular: 200, codigo: "GINE001" },
      { nome: "Preventivo", tipo: "exame", valor_particular: 100, codigo: "GINE002" },
      { nome: "Ultrassom Pélvico", tipo: "exame", valor_particular: 120, codigo: "GINE003" },
      { nome: "Colposcopia", tipo: "exame", valor_particular: 180, codigo: "GINE004" }
    ]
  },
  "Neurologia": {
    medicos_padrao: ["Dr. Roberto Alves"],
    atendimentos: [
      { nome: "Consulta Neurológica", tipo: "consulta", valor_particular: 250, codigo: "NEUR001" },
      { nome: "Eletroencefalograma", tipo: "exame", valor_particular: 200, codigo: "NEUR002" },
      { nome: "Eletromiografia", tipo: "exame", valor_particular: 300, codigo: "NEUR003" },
      { nome: "Doppler Transcraniano", tipo: "exame", valor_particular: 250, codigo: "NEUR004" }
    ]
  },
  "Oftalmologia": {
    medicos_padrao: ["Dr. Paulo Costa"],
    atendimentos: [
      { nome: "Consulta Oftalmológica", tipo: "consulta", valor_particular: 180, codigo: "OFTA001" },
      { nome: "Exame de Vista", tipo: "exame", valor_particular: 80, codigo: "OFTA002" },
      { nome: "Tonometria", tipo: "exame", valor_particular: 60, codigo: "OFTA003" },
      { nome: "Fundo de Olho", tipo: "exame", valor_particular: 100, codigo: "OFTA004" }
    ]
  }
};