
-- Adicionar informações complementares ao Dr. Aristófilo
UPDATE business_rules 
SET config = config || '{
  "pacotes_especiais": [
    {
      "nome": "ECG + Consulta",
      "servicos": ["ECG", "Consulta Cardiológica"],
      "valor": 350.00,
      "economia": 10.00,
      "observacao": "Valor promocional para agendamento conjunto"
    }
  ],
  "regras_chegada": {
    "primeiro_grupo_dia": {
      "antecedencia_minutos": 30,
      "descricao": "Pacientes do primeiro horário devem chegar 30 minutos antes"
    },
    "demais_grupos": {
      "antecedencia_minutos": 15,
      "descricao": "Demais pacientes devem chegar 15 minutos antes"
    }
  },
  "entrega_resultados": {
    "ECO": {
      "prazo_dias": 30,
      "descricao": "Resultado do Ecocardiograma em até 30 dias"
    },
    "TESTE ERGOMÉTRICO": {
      "prazo_dias": 15,
      "descricao": "Resultado do Teste Ergométrico em até 15 dias"
    }
  }
}'::jsonb,
updated_at = now()
WHERE id = 'aa224613-09ad-42a9-b23b-421b8dad299b';
