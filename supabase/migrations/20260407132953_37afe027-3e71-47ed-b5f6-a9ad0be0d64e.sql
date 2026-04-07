-- Corrigir convênios agrupados em strings separadas por vírgula no array convenios_aceitos
-- Esta função normaliza o array, separando itens que contêm vírgulas internas

CREATE OR REPLACE FUNCTION public.normalizar_convenios_aceitos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  novo_array text[];
  item text;
  sub_item text;
BEGIN
  FOR r IN 
    SELECT id, convenios_aceitos 
    FROM medicos 
    WHERE convenios_aceitos IS NOT NULL
  LOOP
    novo_array := '{}';
    FOREACH item IN ARRAY r.convenios_aceitos
    LOOP
      IF position(',' IN item) > 0 THEN
        -- Separar por vírgula e adicionar cada sub-item
        FOREACH sub_item IN ARRAY string_to_array(item, ',')
        LOOP
          sub_item := upper(trim(sub_item));
          IF sub_item != '' AND NOT (sub_item = ANY(novo_array)) THEN
            novo_array := array_append(novo_array, sub_item);
          END IF;
        END LOOP;
      ELSE
        item := upper(trim(item));
        IF item != '' AND NOT (item = ANY(novo_array)) THEN
          novo_array := array_append(novo_array, item);
        END IF;
      END IF;
    END LOOP;
    
    -- Só atualizar se mudou
    IF novo_array IS DISTINCT FROM r.convenios_aceitos THEN
      UPDATE medicos SET convenios_aceitos = novo_array WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

-- Executar normalização
SELECT public.normalizar_convenios_aceitos();

-- Remover função após uso
DROP FUNCTION public.normalizar_convenios_aceitos();