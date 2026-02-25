

## Adicionar tipos específicos de UNIMED na Clínica Olhos

### Situação atual

Apenas 2 médicos da Clínica Olhos têm "UNIMED" (genérico) no `convenios_aceitos`:
- **Dra. Camila Leite** (`e61c3063`)
- **Dr. Guilherme Lucena** (`f9a5aab1`)

Os outros 5 médicos (João, Manoel, Hermann, Isabelle, Marina) **não** têm UNIMED.

### O que será feito

Substituir o "UNIMED" genérico pelos 5 tipos específicos nos 2 médicos que aceitam UNIMED:

| Antes | Depois |
|-------|--------|
| UNIMED | UNIMED NACIONAL |
| | UNIMED REGIONAL |
| | UNIMED INTERCAMBIO |
| | UNIMED 20% |
| | UNIMED 40% |

### Mudanças no banco (2 UPDATEs)

**Dra. Camila** — remover "UNIMED", adicionar os 5 tipos:
```
convenios_aceitos = [UNIMED NACIONAL, UNIMED REGIONAL, UNIMED INTERCAMBIO, UNIMED 20%, UNIMED 40%, MEDSAUDE, MEDCLIN, MEDREV, CASSI, GEAP, CPP, SAUDE CAIXA, MINERAÇÃO, CARAÍBA, CAMED, PARTICULAR]
```

**Dr. Guilherme** — remover "UNIMED", adicionar os 5 tipos:
```
convenios_aceitos = [UNIMED NACIONAL, UNIMED REGIONAL, UNIMED INTERCAMBIO, UNIMED 20%, UNIMED 40%, MEDSAUDE, MEDCLIN, CASSI, GEAP, CPP, SAUDE CAIXA, MINERAÇÃO, CARAÍBA, CAMED, PARTICULAR, DR VISÃO, HGU]
```

### Impacto

- O trigger `validate_patient_insurance` já faz match exato normalizado — com os tipos específicos cadastrados, "UNIMED NACIONAL" do paciente vai bater com "UNIMED NACIONAL" do médico
- Nenhuma alteração de código ou trigger necessária
- A LLM API lê dinamicamente os convênios aceitos, então já refletirá automaticamente

### Detalhes técnicos

Serão 2 comandos UPDATE na tabela `medicos` usando o insert tool (operação de dados, não de schema).

