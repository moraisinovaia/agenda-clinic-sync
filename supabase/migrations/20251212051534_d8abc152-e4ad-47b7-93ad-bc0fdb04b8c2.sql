-- Migrar todos os 21 profissionais da INOVAIA para ENDOGASTRO e ativá-los
UPDATE medicos 
SET 
  cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', -- ENDOGASTRO
  ativo = true
WHERE cliente_id = '0a77ac7c-b0dc-4945-bf62-b2dec26d6df1'; -- INOVAIA