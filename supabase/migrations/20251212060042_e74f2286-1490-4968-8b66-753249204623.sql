-- Atualizar Dr. Fábio Drubi - Detalhar convênios por tipo de atendimento
UPDATE medicos 
SET 
  convenios_restricoes = '{
    "Consulta_convenios": "PARTICULAR, MEDPREV, AGENDA VALE. Idade mín 13 anos",
    "Unimed": "Apenas carteirinha iniciando com 0210. NÃO atende Intercâmbio. APENAS EXAMES",
    "HGU": "Guias autorizadas com validade. APENAS EXAMES",
    "ENMG_convenios": "Unimed 0210, HGU, Medprev, Agenda Vale, Med Saúde, Sertão Saúde, pac Dr.Nivo Melo",
    "EEG_convenios": "Particular, Medprev, Agenda Vale, Unimed 0210"
  }'::jsonb,
  observacoes = 'CONSULTA: APENAS PARTICULAR, MEDPREV, AGENDA VALE. Idade mín 13 anos. R$400,00 (espécie/PIX).
EEG: mín 8 anos, não agitado, sem sedação/vigília/ferimentos cabeça. Convênios: Particular, Medprev, Agenda Vale, Unimed 0210 (NÃO intercâmbio). Valores: Simples R$120 | c/Map R$180.
ENMG: mín 15 anos. Convênios: Unimed só nº0210, HGU (guias autorizadas), Medprev, Agenda Vale, Med Saúde, Sertão Saúde, pac Dr.Nivo Melo. Valores: 2m R$615 | 4m R$1.230 | Paralisia R$340.
Resultados: 4-5 dias úteis. Pagamento particular: espécie ou PIX.
TERÇA/QUINTA: Consultas 07pac 13-15h (30min antes 1º grupo).
TERÇA/SÁBADO: EEG 05pac 08-09:30 (30min antes 1º).
QUARTA manhã: ENMG 14m + 4m Med Saúde 07:30-10h.
QUARTA tarde: ENMG 10m + 4m Sertão + 2m Dr.Nivo 12:30-15:30.
SEXTA manhã: ENMG 20m 07:30-10h.
SEXTA tarde: ENMG 14m + 2m Dr.Nivo 13-15:30.'
WHERE id = '477006ad-d1e2-47f8-940a-231f873def96';