-- Adicionar tipo "retorno" aos atendimentos
INSERT INTO public.atendimentos (nome, tipo, valor_particular, observacoes, ativo)
VALUES ('Retorno', 'retorno', 50.00, 'Consulta de retorno para acompanhamento', true);