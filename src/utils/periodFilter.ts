// Faixas horárias dos períodos (definidas com o usuário):
// Manhã: até 13:00 / Tarde: 13:00–18:00 / Noite: após 18:00
export type PeriodFilter = 'all' | 'manha' | 'tarde' | 'noite';

export const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'Todos',
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

/**
 * Retorna true se o horário (HH:mm ou HH:mm:ss) pertence ao período selecionado.
 * - manha: hora < 13:00
 * - tarde: 13:00 <= hora < 18:00
 * - noite: hora >= 18:00
 */
export function matchesPeriod(hora: string | null | undefined, period: PeriodFilter): boolean {
  if (period === 'all') return true;
  if (!hora) return false;
  const [hStr, mStr] = hora.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  if (Number.isNaN(h)) return false;
  const minutes = h * 60 + (Number.isNaN(m) ? 0 : m);
  const THIRTEEN = 13 * 60;
  const EIGHTEEN = 18 * 60;
  switch (period) {
    case 'manha':
      return minutes < THIRTEEN;
    case 'tarde':
      return minutes >= THIRTEEN && minutes < EIGHTEEN;
    case 'noite':
      return minutes >= EIGHTEEN;
    default:
      return true;
  }
}
