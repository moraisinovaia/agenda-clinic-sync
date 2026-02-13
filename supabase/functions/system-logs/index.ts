import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  context?: string;
  userId?: string;
  sessionId?: string;
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

    if (req.method === 'POST') {
      const logEntry: LogEntry = await req.json()

      // Validar entrada de log
      if (!logEntry.timestamp || !logEntry.level || !logEntry.message) {
        return new Response(
          JSON.stringify({ error: 'Invalid log entry format' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Inserir log na tabela system_logs
      const { error } = await supabase
        .from('system_logs')
        .insert([{
          timestamp: logEntry.timestamp,
          level: logEntry.level,
          message: logEntry.message,
          data: logEntry.data || null,
          context: logEntry.context || null,
          user_id: logEntry.userId || null,
          session_id: logEntry.sessionId || null,
          created_at: new Date().toISOString()
        }])

      if (error) {
        console.error('Error inserting log:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to store log' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const level = url.searchParams.get('level')
      const context = url.searchParams.get('context')
      const limit = parseInt(url.searchParams.get('limit') || '100')
      const offset = parseInt(url.searchParams.get('offset') || '0')

      let query = supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (level) {
        query = query.eq('level', level)
      }

      if (context) {
        query = query.eq('context', context)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching logs:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch logs' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response(
        JSON.stringify({ logs: data }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})