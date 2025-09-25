import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🗄️ Auto backup function called')
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('📊 Creating backup...')

    // Get all tables to backup
    const tablesToBackup = [
      'agendamentos',
      'pacientes', 
      'medicos',
      'atendimentos',
      'bloqueios_agenda',
      'fila_espera',
      'system_settings',
      'profiles'
    ]

    const backupData: Record<string, any> = {}
    
    // Backup each table
    for (const table of tablesToBackup) {
      try {
        console.log(`📋 Backing up table: ${table}`)
        const { data, error } = await supabase
          .from(table)
          .select('*')
        
        if (error) {
          console.error(`Error backing up ${table}:`, error)
          backupData[table] = { error: error.message, data: [] }
        } else {
          backupData[table] = { data: data || [], count: data?.length || 0 }
        }
      } catch (tableError) {
        const errorMessage = tableError instanceof Error ? tableError.message : 'Unknown error'
        console.error(`Exception backing up ${table}:`, errorMessage)
        backupData[table] = { error: errorMessage, data: [] }
      }
    }

    // Calculate backup stats
    const totalRecords = Object.values(backupData).reduce((sum: number, table: any) => {
      return sum + (table.count || 0)
    }, 0)

    // Save backup record
    const backupRecord = {
      backup_type: 'automatic',
      status: 'completed',
      total_tables: tablesToBackup.length,
      total_records: totalRecords,
      backup_data: backupData,
      created_at: new Date().toISOString()
    }

    const { error: insertError } = await supabase
      .from('system_backups')
      .insert([backupRecord])

    if (insertError) {
      console.error('Error saving backup record:', insertError)
    }

    // Log success
    await supabase
      .from('system_logs')
      .insert([{
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Backup automático concluído: ${totalRecords} registros`,
        context: 'AUTO_BACKUP_SUCCESS',
        data: { 
          tables: tablesToBackup.length,
          records: totalRecords
        }
      }])

    console.log('✅ Backup completed successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Backup automático concluído',
        stats: {
          tables: tablesToBackup.length,
          records: totalRecords,
          timestamp: new Date().toISOString()
        }
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in auto backup:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
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
          message: `Falha no backup automático: ${errorMessage}`,
          context: 'AUTO_BACKUP_ERROR',
          data: { error: errorMessage, stack: errorStack }
        }])
    } catch (logError) {
      console.error('Error logging backup failure:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Falha no backup automático', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})