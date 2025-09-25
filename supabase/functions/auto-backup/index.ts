import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SystemSettings {
  [key: string]: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Auto-backup function iniciada:', new Date().toISOString())

    // Buscar configurações do sistema
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value, type')
      .in('key', [
        'auto_backup_enabled',
        'auto_backup_interval', 
        'auto_backup_include_data',
        'auto_backup_include_schema',
        'auto_backup_tables'
      ])

    if (settingsError) {
      console.error('Erro ao buscar configurações:', settingsError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Converter array de configurações em objeto
    const settings: SystemSettings = {}
    settingsData?.forEach(setting => {
      settings[setting.key] = setting.value
    })

    // Verificar se backup automático está habilitado
    if (settings.auto_backup_enabled !== 'true') {
      console.log('Backup automático desabilitado')
      return new Response(
        JSON.stringify({ message: 'Backup automático desabilitado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar último backup automático
    const { data: lastBackup } = await supabase
      .from('system_backups')
      .select('created_at')
      .eq('backup_type', 'automatic')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const intervalHours = parseInt(settings.auto_backup_interval) || 24
    const now = new Date()
    let shouldBackup = true

    if (lastBackup) {
      const lastBackupDate = new Date(lastBackup.created_at)
      const hoursSinceLastBackup = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceLastBackup < intervalHours) {
        shouldBackup = false
        console.log(`Último backup foi há ${hoursSinceLastBackup.toFixed(1)} horas, intervalo configurado: ${intervalHours}h`)
      }
    }

    if (!shouldBackup) {
      return new Response(
        JSON.stringify({ message: 'Backup não necessário ainda' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Executar backup
    console.log('Iniciando backup automático...')
    
    const backupId = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    const backupConfig = {
      includeData: settings.auto_backup_include_data === 'true',
      includeSchema: settings.auto_backup_include_schema === 'true',
      tables: settings.auto_backup_tables ? JSON.parse(settings.auto_backup_tables) : [
        'agendamentos', 'pacientes', 'medicos', 'atendimentos', 'profiles',
        'bloqueios_agenda', 'fila_espera', 'preparos', 'configuracoes_clinica'
      ],
      compressionLevel: 1
    }

    const backupData: any = {
      id: backupId,
      timestamp,
      config: backupConfig
    }

    // Backup dos dados se configurado
    if (backupConfig.includeData) {
      backupData.data = {}
      
      for (const table of backupConfig.tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')

          if (error) {
            console.warn(`Warning backing up table ${table}:`, error)
            continue
          }

          backupData.data[table] = data
          console.log(`Backed up ${data?.length || 0} records from ${table}`)
        } catch (err) {
          console.warn(`Error backing up table ${table}:`, err)
        }
      }
    }

    // Salvar backup metadata
    const totalRecords = Object.values(backupData.data || {}).reduce(
      (sum: number, records: any) => sum + (records?.length || 0), 0
    )

    const { error: saveError } = await supabase
      .from('system_backups')
      .insert([{
        id: backupId,
        created_at: timestamp,
        status: 'completed',
        backup_type: 'automatic',
        table_count: backupConfig.tables.length,
        data_size: JSON.stringify(backupData).length,
        config: backupConfig,
        metadata: {
          tables: backupConfig.tables,
          total_records: totalRecords,
          automated: true,
          cron_execution: true
        }
      }])

    if (saveError) {
      console.error('Error saving backup metadata:', saveError)
      throw saveError
    }

    // Log de sucesso
    await supabase
      .from('system_logs')
      .insert([{
        timestamp: now.toISOString(),
        level: 'info',
        message: `Backup automático criado com sucesso: ${backupId}`,
        context: 'AUTO_BACKUP',
        data: {
          backup_id: backupId,
          tables_count: backupConfig.tables.length,
          total_records: totalRecords,
          data_size_bytes: JSON.stringify(backupData).length
        }
      }])

    // Executar limpeza de backups antigos
    try {
      const { error: cleanupError } = await supabase.rpc('cleanup_old_backups_auto')
      if (cleanupError) {
        console.warn('Erro na limpeza de backups antigos:', cleanupError)
      }
    } catch (cleanupErr) {
      console.warn('Erro na limpeza:', cleanupErr)
    }

    console.log(`Backup automático ${backupId} concluído com sucesso`)

    return new Response(
      JSON.stringify({
        success: true,
        backupId,
        timestamp,
        totalRecords,
        tablesCount: backupConfig.tables.length,
        message: 'Backup automático executado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro no backup automático:', error)
    
    // Log do erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabase
        .from('system_logs')
        .insert([{
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Falha no backup automático: ${error?.message || 'Erro desconhecido'}`,
          context: 'AUTO_BACKUP_ERROR',
          data: { error: error?.message || 'Erro desconhecido', stack: error?.stack }
        }])
    } catch (logError) {
      console.error('Erro ao fazer log:', logError)
    }

    return new Response(
      JSON.stringify({ error: 'Falha no backup automático', details: error?.message || 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})