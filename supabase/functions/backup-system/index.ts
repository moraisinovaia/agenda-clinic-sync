import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackupConfig {
  includeData: boolean;
  includeSchema: boolean;
  tables?: string[];
  compressionLevel?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // --- JWT Validation ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Não autorizado' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const jwtClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await jwtClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ error: 'Token inválido' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  // --- End JWT Validation ---

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    switch (action) {
      case 'create':
        return await createBackup(req, supabase)
      case 'restore':
        return await restoreBackup(req, supabase)
      case 'list':
        return await listBackups(supabase)
      case 'delete':
        return await deleteBackup(req, supabase)
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
    }
  } catch (error) {
    console.error('Backup function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function createBackup(req: Request, supabase: any) {
  const config: BackupConfig = await req.json()
  const backupId = crypto.randomUUID()
  const timestamp = new Date().toISOString()

  try {
    console.log('Creating backup:', backupId)
    
    const backupData: any = {
      id: backupId,
      timestamp,
      config
    }

    // Backup das tabelas principais
    const mainTables = [
      'agendamentos',
      'pacientes', 
      'medicos',
      'atendimentos',
      'profiles',
      'bloqueios_agenda',
      'fila_espera',
      'preparos',
      'configuracoes_clinica'
    ]

    const tablesToBackup = config.tables || mainTables

    if (config.includeData) {
      backupData.data = {}
      
      for (const table of tablesToBackup) {
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

    // Salvar backup metadata na tabela system_backups
    const { error: saveError } = await supabase
      .from('system_backups')
      .insert([{
        id: backupId,
        created_at: timestamp,
        status: 'completed',
        backup_type: 'manual',
        table_count: tablesToBackup.length,
        data_size: JSON.stringify(backupData).length,
        config: config,
        metadata: {
          tables: tablesToBackup,
          total_records: Object.values(backupData.data || {}).reduce((sum: number, records: any) => sum + (records?.length || 0), 0)
        }
      }])

    if (saveError) {
      console.error('Error saving backup metadata:', saveError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        backupId, 
        timestamp,
        message: 'Backup criado com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Backup creation error:', error)
    
    // Registrar falha no backup
    await supabase
      .from('system_backups')
      .insert([{
        id: backupId,
        created_at: timestamp,
        status: 'failed',
        backup_type: 'manual',
        error_message: error?.message || 'Erro desconhecido'
      }])
      .catch(console.error)

    return new Response(
      JSON.stringify({ error: 'Failed to create backup' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function restoreBackup(req: Request, supabase: any) {
  const { backupId } = await req.json()

  try {
    console.log('Restoring backup:', backupId)

    // Buscar backup
    const { data: backup, error: fetchError } = await supabase
      .from('system_backups')
      .select('*')
      .eq('id', backupId)
      .single()

    if (fetchError || !backup) {
      return new Response(
        JSON.stringify({ error: 'Backup not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // IMPORTANTE: Em um ambiente real, esta operação seria muito perigosa
    // Implementar apenas para recuperação de emergência com confirmação adicional
    
    return new Response(
      JSON.stringify({ 
        message: 'Restore functionality requires manual intervention for safety',
        backup: {
          id: backup.id,
          created_at: backup.created_at,
          table_count: backup.table_count,
          data_size: backup.data_size
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Restore error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to restore backup' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function listBackups(supabase: any) {
  try {
    const { data: backups, error } = await supabase
      .from('system_backups')
      .select('id, created_at, status, backup_type, table_count, data_size, metadata')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ backups }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('List backups error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list backups' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}

async function deleteBackup(req: Request, supabase: any) {
  const { backupId } = await req.json()

  try {
    const { error } = await supabase
      .from('system_backups')
      .delete()
      .eq('id', backupId)

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Backup deletado com sucesso' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Delete backup error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to delete backup' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}