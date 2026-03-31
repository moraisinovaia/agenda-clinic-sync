

## Adicionar convênio HGU para Dra. Camila e Dra. Marina (Clínica Olhos)

### O que será feito

Adicionar "HGU" ao array `convenios_aceitos` de dois médicos que ainda não possuem:

1. **Dra. Camila Leite de Carvalho Moura** (`e61c3063-...`)
2. **Dra. Marina Tozzi** (`ddf2d7e6-...`)

Os outros 5 médicos já possuem HGU configurado.

### Execução

Uma única operação SQL (UPDATE) via insert tool para cada médico, adicionando 'HGU' ao array `convenios_aceitos`.

### Risco
- Nenhum. Apenas adiciona um valor ao array existente sem alterar estrutura.

