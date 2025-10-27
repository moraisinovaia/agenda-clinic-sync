-- Remover constraint existente que aponta para auth.users
ALTER TABLE agendamentos 
DROP CONSTRAINT IF EXISTS agendamentos_criado_por_user_id_fkey;

-- Criar constraints corretas apontando para profiles.user_id
ALTER TABLE agendamentos
ADD CONSTRAINT agendamentos_criado_por_user_id_fkey
FOREIGN KEY (criado_por_user_id) 
REFERENCES profiles(user_id)
ON DELETE SET NULL;

ALTER TABLE agendamentos
ADD CONSTRAINT agendamentos_alterado_por_user_id_fkey
FOREIGN KEY (alterado_por_user_id) 
REFERENCES profiles(user_id)
ON DELETE SET NULL;

ALTER TABLE agendamentos
ADD CONSTRAINT agendamentos_cancelado_por_user_id_fkey
FOREIGN KEY (cancelado_por_user_id) 
REFERENCES profiles(user_id)
ON DELETE SET NULL;

ALTER TABLE agendamentos
ADD CONSTRAINT agendamentos_confirmado_por_user_id_fkey
FOREIGN KEY (confirmado_por_user_id) 
REFERENCES profiles(user_id)
ON DELETE SET NULL;

ALTER TABLE agendamentos
ADD CONSTRAINT agendamentos_excluido_por_user_id_fkey
FOREIGN KEY (excluido_por_user_id) 
REFERENCES profiles(user_id)
ON DELETE SET NULL;