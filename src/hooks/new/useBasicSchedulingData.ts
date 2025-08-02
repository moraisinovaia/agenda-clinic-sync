import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Doctor, Atendimento } from '@/types/scheduling';

interface SchedulingData {
  doctors: Doctor[];
  atendimentos: Atendimento[];
  loading: boolean;
  error: string | null;
}

export function useBasicSchedulingData(): SchedulingData {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [doctorsResult, atendimentosResult] = await Promise.all([
          supabase
            .from('medicos')
            .select('*')
            .eq('ativo', true)
            .order('nome'),
          supabase
            .from('atendimentos')
            .select('*')
            .eq('ativo', true)
            .order('nome')
        ]);

        if (!mounted) return;

        if (doctorsResult.error) {
          console.warn('Erro ao buscar médicos:', doctorsResult.error);
          setError('Erro ao carregar médicos');
          return;
        }

        if (atendimentosResult.error) {
          console.warn('Erro ao buscar atendimentos:', atendimentosResult.error);
          setError('Erro ao carregar atendimentos');
          return;
        }

        setDoctors(doctorsResult.data || []);
        setAtendimentos(atendimentosResult.data || []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        console.warn('Erro ao carregar dados:', err);
        setError('Erro ao carregar dados');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    doctors,
    atendimentos,
    loading,
    error
  };
}