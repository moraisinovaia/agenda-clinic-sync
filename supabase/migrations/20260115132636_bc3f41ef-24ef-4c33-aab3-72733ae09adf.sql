-- Corrigir: Atualizar Dr. Marcelo D'Carli (ID: 7e08a5cd-270d-4441-9baa-b6a97b7407e6)
-- O caminho correto é dentro de "servicos"

-- Consulta Cardiológica
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{servicos,Consulta Cardiológica,periodos,manha,contagem_inicio}', '"07:00"'
      ),
      '{servicos,Consulta Cardiológica,periodos,manha,contagem_fim}', '"12:00"'
    ),
    '{servicos,Consulta Cardiológica,periodos,tarde,contagem_inicio}', '"12:00"'
  ),
  '{servicos,Consulta Cardiológica,periodos,tarde,contagem_fim}', '"18:00"'
)
WHERE id = '7e08a5cd-270d-4441-9baa-b6a97b7407e6';

-- Retorno Cardiológico
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{servicos,Retorno Cardiológico,periodos,manha,contagem_inicio}', '"07:00"'
      ),
      '{servicos,Retorno Cardiológico,periodos,manha,contagem_fim}', '"12:00"'
    ),
    '{servicos,Retorno Cardiológico,periodos,tarde,contagem_inicio}', '"12:00"'
  ),
  '{servicos,Retorno Cardiológico,periodos,tarde,contagem_fim}', '"18:00"'
)
WHERE id = '7e08a5cd-270d-4441-9baa-b6a97b7407e6';

-- ECG (Eletrocardiograma)
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{servicos,ECG (Eletrocardiograma),periodos,manha,contagem_inicio}', '"07:00"'
      ),
      '{servicos,ECG (Eletrocardiograma),periodos,manha,contagem_fim}', '"12:00"'
    ),
    '{servicos,ECG (Eletrocardiograma),periodos,tarde,contagem_inicio}', '"12:00"'
  ),
  '{servicos,ECG (Eletrocardiograma),periodos,tarde,contagem_fim}', '"18:00"'
)
WHERE id = '7e08a5cd-270d-4441-9baa-b6a97b7407e6';

-- Teste Ergométrico no Dr. Marcelo D'Carli
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{servicos,Teste Ergométrico,periodos,manha,contagem_inicio}', '"07:00"'
      ),
      '{servicos,Teste Ergométrico,periodos,manha,contagem_fim}', '"12:00"'
    ),
    '{servicos,Teste Ergométrico,periodos,tarde,contagem_inicio}', '"12:00"'
  ),
  '{servicos,Teste Ergométrico,periodos,tarde,contagem_fim}', '"18:00"'
)
WHERE id = '7e08a5cd-270d-4441-9baa-b6a97b7407e6';

-- Atualizar Teste Ergométrico - Dr. Marcelo (registro separado, ID: 7273a6cc-5867-41b8-8551-2f2b30e217c0)
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{servicos,Teste Ergométrico,periodos,manha,contagem_inicio}', '"07:00"'
      ),
      '{servicos,Teste Ergométrico,periodos,manha,contagem_fim}', '"12:00"'
    ),
    '{servicos,Teste Ergométrico,periodos,tarde,contagem_inicio}', '"12:00"'
  ),
  '{servicos,Teste Ergométrico,periodos,tarde,contagem_fim}', '"18:00"'
)
WHERE id = '7273a6cc-5867-41b8-8551-2f2b30e217c0';