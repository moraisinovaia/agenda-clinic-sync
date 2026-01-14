-- Remover políticas antigas permissivas duplicadas em fila_notificacoes (CRÍTICO)
-- As políticas corretas já existem: fila_notificacoes_select_by_cliente, etc.

DROP POLICY IF EXISTS "Permitir leitura geral fila_notificacoes" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Permitir inserção geral fila_notificacoes" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Permitir atualização geral fila_notificacoes" ON public.fila_notificacoes;
DROP POLICY IF EXISTS "Permitir exclusão geral fila_notificacoes" ON public.fila_notificacoes;