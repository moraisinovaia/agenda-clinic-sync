-- Adicionar colunas de valor na tabela preparos
ALTER TABLE public.preparos 
ADD COLUMN valor_particular NUMERIC,
ADD COLUMN valor_convenio NUMERIC,
ADD COLUMN forma_pagamento CHARACTER VARYING,
ADD COLUMN observacoes_valor TEXT;

-- Comentários para documentar as novas colunas
COMMENT ON COLUMN public.preparos.valor_particular IS 'Valor do preparo para pacientes particulares';
COMMENT ON COLUMN public.preparos.valor_convenio IS 'Valor do preparo para convênios';
COMMENT ON COLUMN public.preparos.forma_pagamento IS 'Forma de pagamento aceita para o preparo';
COMMENT ON COLUMN public.preparos.observacoes_valor IS 'Observações específicas sobre valores e formas de pagamento';