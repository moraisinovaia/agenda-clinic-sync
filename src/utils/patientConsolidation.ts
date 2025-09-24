import { supabase } from '@/integrations/supabase/client';
import { ConsolidatedPatient, consolidatePatients } from '@/types/consolidated-patient';
import { Patient } from '@/types/scheduling';

interface ConsolidationReport {
  totalPatients: number;
  duplicatesFound: number;
  recordsRemoved: number;
  errors: string[];
}

/**
 * Função para consolidar pacientes duplicados no banco de dados
 * Identifica duplicatas baseado em nome_completo + data_nascimento
 * Remove registros duplicados mantendo apenas o mais recente
 * 
 * @param dryRun Se true, apenas simula a operação sem fazer alterações
 * @returns Relatório da operação de consolidação
 */
export async function consolidatePatientDatabase(dryRun: boolean = true): Promise<ConsolidationReport> {
  const report: ConsolidationReport = {
    totalPatients: 0,
    duplicatesFound: 0,
    recordsRemoved: 0,
    errors: []
  };

  try {
    console.log('🔄 Iniciando consolidação de pacientes...');
    console.log(`📋 Modo: ${dryRun ? 'DRY RUN (simulação)' : 'EXECUÇÃO REAL'}`);

    // 1. Buscar todos os pacientes
    const { data: allPatients, error: fetchError } = await supabase
      .from('pacientes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (fetchError) {
      report.errors.push(`Erro ao buscar pacientes: ${fetchError.message}`);
      return report;
    }

    if (!allPatients || allPatients.length === 0) {
      console.log('ℹ️  Nenhum paciente encontrado no banco');
      return report;
    }

    report.totalPatients = allPatients.length;
    console.log(`📊 Total de pacientes no banco: ${report.totalPatients}`);

    // 2. Buscar últimos convênios usados em agendamentos
    const { data: lastAppointments } = await supabase
      .from('agendamentos')
      .select('paciente_id, convenio, data_agendamento, hora_agendamento')
      .in('paciente_id', allPatients.map(p => p.id))
      .order('data_agendamento', { ascending: false })
      .order('hora_agendamento', { ascending: false });

    // Mapear último convênio por paciente
    const lastConvenios: Record<string, string> = {};
    if (lastAppointments) {
      const patientToKeyMap: Record<string, string> = {};
      allPatients.forEach(p => {
        patientToKeyMap[p.id] = `${p.nome_completo}-${p.data_nascimento}`;
      });

      lastAppointments.forEach(appointment => {
        const patientKey = patientToKeyMap[appointment.paciente_id];
        if (patientKey && !lastConvenios[patientKey] && appointment.convenio) {
          lastConvenios[patientKey] = appointment.convenio;
        }
      });
    }

    // 3. Identificar duplicatas usando a lógica de consolidação
    const consolidated = consolidatePatients(allPatients as Patient[], lastConvenios);
    
    // 4. Identificar quais pacientes têm múltiplos registros
    const patientGroups = new Map<string, Patient[]>();
    allPatients.forEach(patient => {
      const key = `${patient.nome_completo.toLowerCase().trim()}-${patient.data_nascimento}`;
      if (!patientGroups.has(key)) {
        patientGroups.set(key, []);
      }
      patientGroups.get(key)!.push(patient as Patient);
    });

    const duplicateGroups = Array.from(patientGroups.values()).filter(group => group.length > 1);
    report.duplicatesFound = duplicateGroups.reduce((acc, group) => acc + (group.length - 1), 0);
    
    console.log(`🔍 Encontrados ${duplicateGroups.length} grupos de pacientes com duplicatas`);
    console.log(`📈 Total de registros duplicados: ${report.duplicatesFound}`);

    // 5. Se for dry run, apenas relatar
    if (dryRun) {
      console.log('\n📋 RELATÓRIO DE DUPLICATAS (DRY RUN):');
      duplicateGroups.forEach((group, index) => {
        const sortedGroup = group.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        const mostRecent = sortedGroup[0];
        const toRemove = sortedGroup.slice(1);

        console.log(`\n${index + 1}. ${mostRecent.nome_completo} (${mostRecent.data_nascimento})`);
        console.log(`   📄 Convênios: ${group.map(p => p.convenio).join(', ')}`);
        console.log(`   🗑️  Seriam removidos: ${toRemove.length} registros`);
        console.log(`   ✅ Seria mantido: ID ${mostRecent.id} (mais recente)`);
      });
      
      console.log(`\n📊 RESUMO:`);
      console.log(`   • Total de pacientes: ${report.totalPatients}`);
      console.log(`   • Grupos duplicados: ${duplicateGroups.length}`);
      console.log(`   • Registros que seriam removidos: ${report.duplicatesFound}`);
      console.log(`   • Pacientes únicos após consolidação: ${report.totalPatients - report.duplicatesFound}`);
      
      return report;
    }

    // 6. Executar remoção real das duplicatas
    console.log('\n🔥 EXECUTANDO REMOÇÃO DE DUPLICATAS...');
    
    for (const group of duplicateGroups) {
      const sortedGroup = group.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      const mostRecent = sortedGroup[0];
      const toRemove = sortedGroup.slice(1);

      console.log(`\n🏥 Processando: ${mostRecent.nome_completo}`);
      console.log(`   ✅ Mantendo: ID ${mostRecent.id}`);
      
      // Remover registros duplicados
      for (const duplicate of toRemove) {
        console.log(`   🗑️  Removendo: ID ${duplicate.id} (${duplicate.convenio})`);
        
        const { error: deleteError } = await supabase
          .from('pacientes')
          .delete()
          .eq('id', duplicate.id);

        if (deleteError) {
          const errorMsg = `Erro ao remover paciente ${duplicate.id}: ${deleteError.message}`;
          report.errors.push(errorMsg);
          console.error(`   ❌ ${errorMsg}`);
        } else {
          report.recordsRemoved++;
          console.log(`   ✅ Removido com sucesso`);
        }
      }
    }

    console.log(`\n🎉 CONSOLIDAÇÃO CONCLUÍDA!`);
    console.log(`   • Registros removidos: ${report.recordsRemoved}/${report.duplicatesFound}`);
    console.log(`   • Erros: ${report.errors.length}`);
    
    if (report.errors.length > 0) {
      console.log(`   ⚠️  Erros encontrados:`);
      report.errors.forEach(error => console.log(`     - ${error}`));
    }

  } catch (error) {
    const errorMsg = `Erro inesperado durante consolidação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    report.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
  }

  return report;
}

// Função helper para buscar pacientes consolidados com último convênio
export async function getConsolidatedPatients(): Promise<ConsolidatedPatient[]> {
  try {
    const { data: allPatients, error } = await supabase
      .from('pacientes')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar pacientes:', error);
      return [];
    }

    if (!allPatients || allPatients.length === 0) {
      return [];
    }

    // Buscar últimos convênios
    const { data: lastAppointments } = await supabase
      .from('agendamentos')
      .select('paciente_id, convenio, data_agendamento, hora_agendamento')
      .in('paciente_id', allPatients.map(p => p.id))
      .order('data_agendamento', { ascending: false })
      .order('hora_agendamento', { ascending: false });

    const lastConvenios: Record<string, string> = {};
    if (lastAppointments) {
      const patientToKeyMap: Record<string, string> = {};
      allPatients.forEach(p => {
        patientToKeyMap[p.id] = `${p.nome_completo}-${p.data_nascimento}`;
      });

      lastAppointments.forEach(appointment => {
        const patientKey = patientToKeyMap[appointment.paciente_id];
        if (patientKey && !lastConvenios[patientKey] && appointment.convenio) {
          lastConvenios[patientKey] = appointment.convenio;
        }
      });
    }

    return consolidatePatients(allPatients as Patient[], lastConvenios);
  } catch (error) {
    console.error('Erro inesperado ao buscar pacientes consolidados:', error);
    return [];
  }
}