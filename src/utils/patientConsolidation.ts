import { supabase } from '@/integrations/supabase/client';
import { Patient } from '@/types/scheduling';
import { consolidatePatients, ConsolidatedPatient } from '@/types/consolidated-patient';

interface ConsolidationReport {
  totalPatients: number;
  duplicatesFound: number;
  duplicatesRemoved: number;
  consolidatedPatients: number;
  errors: string[];
}

/**
 * Script para consolidar pacientes duplicados no banco de dados
 * ATENÇÃO: Este script deve ser executado com cuidado, pois modifica dados permanentemente
 */
export async function consolidateExistingPatients(dryRun = true): Promise<ConsolidationReport> {
  const report: ConsolidationReport = {
    totalPatients: 0,
    duplicatesFound: 0,
    duplicatesRemoved: 0,
    consolidatedPatients: 0,
    errors: []
  };

  try {
    console.log(`🔍 Iniciando ${dryRun ? 'análise' : 'consolidação'} de pacientes duplicados...`);

    // 1. Buscar todos os pacientes
    const { data: allPatients, error: fetchError } = await supabase
      .from('pacientes')
      .select('*')
      .order('nome_completo', { ascending: true });

    if (fetchError) {
      report.errors.push(`Erro ao buscar pacientes: ${fetchError.message}`);
      return report;
    }

    if (!allPatients || allPatients.length === 0) {
      console.log('✅ Nenhum paciente encontrado no banco');
      return report;
    }

    report.totalPatients = allPatients.length;
    console.log(`📊 Total de pacientes no banco: ${report.totalPatients}`);

    // 2. Identificar duplicatas usando a lógica de consolidação
    const consolidated = consolidatePatients(allPatients as Patient[]);
    
    // 3. Identificar quais pacientes são duplicatas
    const duplicateGroups = consolidated.filter(group => group.convenios.length > 1);
    report.duplicatesFound = duplicateGroups.reduce((acc, group) => acc + (group.convenios.length - 1), 0);
    
    console.log(`🔍 Encontrados ${duplicateGroups.length} grupos de pacientes com duplicatas`);
    console.log(`📈 Total de registros duplicados: ${report.duplicatesFound}`);

    // 4. Se for dry run, apenas relatar
    if (dryRun) {
      console.log('\n📋 RELATÓRIO DE DUPLICATAS (DRY RUN):');
      duplicateGroups.forEach((group, index) => {
        console.log(`\n${index + 1}. ${group.nome_completo} (${group.data_nascimento})`);
        console.log(`   📄 Convênios: ${group.convenios.map(c => c.convenio).join(', ')}`);
        console.log(`   🗑️  Seriam removidos: ${group.convenios.length - 1} registros`);
        console.log(`   ✅ Seria mantido: ID ${group.id} (mais recente)`);
      });
      
      console.log(`\n📊 RESUMO:`);
      console.log(`   • Total de pacientes: ${report.totalPatients}`);
      console.log(`   • Grupos duplicados: ${duplicateGroups.length}`);
      console.log(`   • Registros que seriam removidos: ${report.duplicatesFound}`);
      console.log(`   • Pacientes após consolidação: ${report.totalPatients - report.duplicatesFound}`);
      
      return report;
    }

    // 5. Executar consolidação real
    console.log('\n🔄 EXECUTANDO CONSOLIDAÇÃO...');
    
    for (const group of duplicateGroups) {
      try {
        // Manter apenas o registro mais recente (já definido em group.id)
        const recordsToDelete = group.convenios
          .filter(convenio => convenio.id !== group.id)
          .map(convenio => convenio.id);

        if (recordsToDelete.length > 0) {
          console.log(`🗑️  Removendo ${recordsToDelete.length} duplicatas de: ${group.nome_completo}`);
          
          // Atualizar agendamentos para apontar para o registro principal
          const { error: updateError } = await supabase
            .from('agendamentos')
            .update({ paciente_id: group.id })
            .in('paciente_id', recordsToDelete);

          if (updateError) {
            report.errors.push(`Erro ao atualizar agendamentos para ${group.nome_completo}: ${updateError.message}`);
            continue;
          }

          // Atualizar fila de espera
          const { error: filaError } = await supabase
            .from('fila_espera')
            .update({ paciente_id: group.id })
            .in('paciente_id', recordsToDelete);

          if (filaError) {
            console.warn(`⚠️  Aviso ao atualizar fila de espera para ${group.nome_completo}: ${filaError.message}`);
          }

          // Remover registros duplicados
          const { error: deleteError } = await supabase
            .from('pacientes')
            .delete()
            .in('id', recordsToDelete);

          if (deleteError) {
            report.errors.push(`Erro ao deletar duplicatas de ${group.nome_completo}: ${deleteError.message}`);
            continue;
          }

          report.duplicatesRemoved += recordsToDelete.length;
        }
      } catch (error) {
        report.errors.push(`Erro geral ao processar ${group.nome_completo}: ${error}`);
      }
    }

    report.consolidatedPatients = report.totalPatients - report.duplicatesRemoved;

    console.log('\n✅ CONSOLIDAÇÃO CONCLUÍDA!');
    console.log(`📊 Registros removidos: ${report.duplicatesRemoved}`);
    console.log(`👥 Pacientes após consolidação: ${report.consolidatedPatients}`);
    
    if (report.errors.length > 0) {
      console.log('\n⚠️  ERROS ENCONTRADOS:');
      report.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    const errorMessage = `Erro geral na consolidação: ${error}`;
    report.errors.push(errorMessage);
    console.error('❌', errorMessage);
  }

  return report;
}

/**
 * Função auxiliar para executar apenas uma análise sem modificar dados
 */
export async function analyzePatientDuplicates(): Promise<ConsolidationReport> {
  return consolidateExistingPatients(true);
}

/**
 * Função auxiliar para executar a consolidação real
 * ATENÇÃO: Esta função modifica permanentemente os dados!
 */
export async function executePatientConsolidation(): Promise<ConsolidationReport> {
  const userConfirmed = window.confirm(
    'ATENÇÃO: Esta ação irá remover permanentemente registros duplicados de pacientes.\n\n' +
    'Certifique-se de ter feito backup dos dados antes de continuar.\n\n' +
    'Deseja prosseguir?'
  );

  if (!userConfirmed) {
    throw new Error('Consolidação cancelada pelo usuário');
  }

  return consolidateExistingPatients(false);
}