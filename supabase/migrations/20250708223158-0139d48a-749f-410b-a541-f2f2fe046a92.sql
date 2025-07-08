-- Atualizar convênios Unimed para primeira letra maiúscula
UPDATE medicos 
SET convenios_aceitos = array_replace(
    array_replace(
        array_replace(
            array_replace(
                array_replace(convenios_aceitos, 'unimed nacional', 'Unimed Nacional'),
                'unimed regional', 'Unimed Regional'
            ),
            'unimed 40%', 'Unimed 40%'
        ),
        'unimed 20%', 'Unimed 20%'
    ),
    'unimed intercâmbio', 'Unimed Intercâmbio'
)
WHERE 'unimed nacional' = ANY(convenios_aceitos) 
   OR 'unimed regional' = ANY(convenios_aceitos) 
   OR 'unimed 40%' = ANY(convenios_aceitos) 
   OR 'unimed 20%' = ANY(convenios_aceitos)
   OR 'unimed intercâmbio' = ANY(convenios_aceitos);