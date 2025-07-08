-- Atualizar convênios Unimed para tipos específicos
-- Primeiro, vamos criar uma função para substituir 'Unimed' pelos novos tipos

-- Para médicos que têm 'Unimed' no array, vamos remover 'Unimed' e adicionar os novos tipos
UPDATE medicos 
SET convenios_aceitos = array_append(
    array_append(
        array_append(
            array_append(
                array_remove(convenios_aceitos, 'Unimed'),
                'unimed nacional'
            ),
            'unimed regional'
        ),
        'unimed 40%'
    ),
    'unimed 20%'
)
WHERE 'Unimed' = ANY(convenios_aceitos);

-- Verificar se há algum médico com 'unimed' em minúsculas e fazer a mesma atualização
UPDATE medicos 
SET convenios_aceitos = array_append(
    array_append(
        array_append(
            array_append(
                array_remove(convenios_aceitos, 'unimed'),
                'unimed nacional'
            ),
            'unimed regional'
        ),
        'unimed 40%'
    ),
    'unimed 20%'
)
WHERE 'unimed' = ANY(convenios_aceitos);