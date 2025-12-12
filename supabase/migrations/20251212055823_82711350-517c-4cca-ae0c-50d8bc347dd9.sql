-- Atualizar Dr. Fábio Drubi - Neurologista ENDOGASTRO
UPDATE medicos 
SET 
  convenios_aceitos = ARRAY[
    'PARTICULAR', 'MEDPREV', 'AGENDA VALE', 'HGU', 
    'UNIMED NACIONAL', 'UNIMED REGIONAL', 
    'UNIMED COPARTICIPAÇÃO 40%', 'UNIMED COPARTICIPAÇÃO 20%', 
    'MED SAÚDE', 'SERTÃO SAÚDE'
  ],
  idade_minima = 8,
  convenios_restricoes = '{
    "Unimed": "Apenas carteirinha iniciando com 0210. NÃO atende Intercâmbio",
    "HGU": "Guias autorizadas com validade, coparticipação não cobra aqui",
    "ENMG_convenios": "Unimed 0210, HGU, Medprev, Agenda Vale, Med Saúde, Sertão Saúde, pac Dr.Nivo Melo",
    "EEG_convenios": "Particular, Medprev, Agenda Vale, Unimed 0210"
  }'::jsonb,
  observacoes = 'Consulta particular: R$400,00 (espécie/PIX). Idade mín consulta: 13 anos.
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