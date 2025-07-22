-- DIA 1: CRIAÇÃO DAS TABELAS DE AUDITORIA MÉDICA
-- Execute estes comandos no Supabase SQL Editor

-- 1. TABELA DE LOGS DE AUDITORIA
CREATE TABLE logs_auditoria_medica (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Dados da pergunta
  pergunta_original TEXT NOT NULL,
  pergunta_normalizada TEXT,
  usuario_telefone VARCHAR(20),
  usuario_nome VARCHAR(255),
  
  -- Classificação
  categoria VARCHAR(20) NOT NULL, -- CRITICO, INFORMATIVO, CONVERSACIONAL
  tipo_pergunta VARCHAR(50) NOT NULL, -- convenios, precos, contatos, etc
  processamento VARCHAR(30) NOT NULL, -- DETERMINISTICO, LLM_VALIDADO, etc
  
  -- Resultado
  resposta_gerada TEXT NOT NULL,
  sucesso BOOLEAN DEFAULT true,
  precisao VARCHAR(10) DEFAULT '100%',
  
  -- Validação
  validacao_passou BOOLEAN DEFAULT false,
  erros_detectados JSONB,
  alertas_gerados JSONB,
  
  -- Dados utilizados
  fonte_dados VARCHAR(50) DEFAULT 'supabase',
  dados_utilizados JSONB,
  hash_resposta VARCHAR(32),
  
  -- Auditoria
  auditoria_completa JSONB,
  requer_revisao BOOLEAN DEFAULT false,
  revisado_por VARCHAR(255),
  revisado_em TIMESTAMPTZ,
  
  -- Metadados
  versao_sistema VARCHAR(20) DEFAULT '1.0',
  ambiente VARCHAR(20) DEFAULT 'producao',
  
  CONSTRAINT valid_categoria CHECK (categoria IN ('CRITICO', 'INFORMATIVO', 'CONVERSACIONAL')),
  CONSTRAINT valid_processamento CHECK (processamento IN ('DETERMINISTICO', 'LLM_VALIDADO', 'LLM_LIVRE'))
);

-- 2. TABELA DE MÉTRICAS DIÁRIAS
CREATE TABLE metricas_diarias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE DEFAULT CURRENT_DATE,
  
  -- Contadores gerais
  total_interacoes INTEGER DEFAULT 0,
  total_criticas INTEGER DEFAULT 0,
  total_informativas INTEGER DEFAULT 0,
  total_conversacionais INTEGER DEFAULT 0,
  
  -- Precisão
  sucessos INTEGER DEFAULT 0,
  erros INTEGER DEFAULT 0,
  taxa_sucesso DECIMAL(5,2),
  
  -- Por categoria
  criticas_corretas INTEGER DEFAULT 0,
  criticas_incorretas INTEGER DEFAULT 0,
  
  -- Alertas
  alertas_gerados INTEGER DEFAULT 0,
  alertas_criticos INTEGER DEFAULT 0,
  
  -- Tempos
  tempo_medio_resposta DECIMAL(8,2),
  tempo_maximo_resposta DECIMAL(8,2),
  
  -- Auditoria
  revisoes_necessarias INTEGER DEFAULT 0,
  revisoes_concluidas INTEGER DEFAULT 0,
  
  -- Metadados
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(data)
);

-- 3. TABELA DE ALERTAS CRÍTICOS
CREATE TABLE alertas_criticos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tipo do alerta
  tipo VARCHAR(50) NOT NULL, -- ERRO_CRITICO, VALIDACAO_FALHOU, DADOS_INCONSISTENTES
  severidade INTEGER NOT NULL DEFAULT 1, -- 1=baixa, 5=crítica
  
  -- Contexto
  pergunta TEXT,
  resposta_problemática TEXT,
  erro_detectado TEXT,
  
  -- Localização
  log_auditoria_id UUID REFERENCES logs_auditoria_medica(id),
  usuario_afetado VARCHAR(20),
  
  -- Resolução
  resolvido BOOLEAN DEFAULT false,
  resolvido_por VARCHAR(255),
  resolvido_em TIMESTAMPTZ,
  acao_tomada TEXT,
  
  -- Notificação
  notificado BOOLEAN DEFAULT false,
  notificado_em TIMESTAMPTZ,
  destinatarios JSONB,
  
  CONSTRAINT valid_severidade CHECK (severidade BETWEEN 1 AND 5)
);

-- 4. TABELA DE VALIDAÇÕES DETALHADAS
CREATE TABLE validacoes_detalhadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_auditoria_id UUID REFERENCES logs_auditoria_medica(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tipo de validação
  tipo_validacao VARCHAR(50) NOT NULL, -- ESTRUTURA_MEDICO, CONVENIO_VALIDO, PRECO_CORRETO
  
  -- Dados da validação
  objeto_validado JSONB, -- dados específicos validados
  regra_aplicada TEXT,
  resultado BOOLEAN,
  erro_detalhado TEXT,
  
  -- Contexto
  valor_esperado TEXT,
  valor_encontrado TEXT,
  fonte_referencia VARCHAR(100),
  
  -- Metadados
  validador VARCHAR(50), -- nome da função/classe que validou
  tempo_validacao DECIMAL(8,3)
);

-- 5. TABELA DE CONFIGURAÇÕES DO SISTEMA
CREATE TABLE config_sistema_auditoria (
  chave VARCHAR(100) PRIMARY KEY,
  valor TEXT NOT NULL,
  tipo VARCHAR(20) DEFAULT 'string', -- string, number, boolean, json
  descricao TEXT,
  categoria VARCHAR(50),
  
  -- Controle
  ativo BOOLEAN DEFAULT true,
  editavel BOOLEAN DEFAULT true,
  requer_reinicio BOOLEAN DEFAULT false,
  
  -- Auditoria da config
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_por VARCHAR(255)
);

-- INSERIR CONFIGURAÇÕES INICIAIS
INSERT INTO config_sistema_auditoria (chave, valor, tipo, descricao, categoria) VALUES
('AUDITORIA_ATIVA', 'true', 'boolean', 'Se auditoria está ativa', 'sistema'),
('ALERTA_EMAIL_ATIVO', 'true', 'boolean', 'Se alertas por email estão ativos', 'alertas'),
('ALERTA_WHATSAPP_ATIVO', 'true', 'boolean', 'Se alertas por WhatsApp estão ativos', 'alertas'),
('PRECISAO_MINIMA_CRITICA', '100', 'number', 'Precisão mínima para perguntas críticas (%)', 'qualidade'),
('TEMPO_MAX_RESPOSTA', '5.0', 'number', 'Tempo máximo de resposta (segundos)', 'performance'),
('BACKUP_LOGS_DIAS', '90', 'number', 'Dias para manter logs de auditoria', 'manutencao'),
('EMAIL_RESPONSAVEL', 'admin@clinica.com', 'string', 'Email do responsável técnico', 'contatos'),
('WHATSAPP_RESPONSAVEL', '5587999990000', 'string', 'WhatsApp do responsável técnico', 'contatos');

-- 6. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_logs_timestamp ON logs_auditoria_medica(timestamp);
CREATE INDEX idx_logs_categoria ON logs_auditoria_medica(categoria);
CREATE INDEX idx_logs_sucesso ON logs_auditoria_medica(sucesso);
CREATE INDEX idx_logs_usuario ON logs_auditoria_medica(usuario_telefone);
CREATE INDEX idx_alertas_timestamp ON alertas_criticos(timestamp);
CREATE INDEX idx_alertas_resolvido ON alertas_criticos(resolvido);
CREATE INDEX idx_metricas_data ON metricas_diarias(data);

-- 7. TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
CREATE OR REPLACE FUNCTION atualizar_metricas_diarias()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO metricas_diarias (
    data, 
    total_interacoes,
    total_criticas,
    sucessos,
    erros,
    alertas_gerados
  )
  SELECT 
    CURRENT_DATE,
    COUNT(*),
    COUNT(*) FILTER (WHERE categoria = 'CRITICO'),
    COUNT(*) FILTER (WHERE sucesso = true),
    COUNT(*) FILTER (WHERE sucesso = false),
    (SELECT COUNT(*) FROM alertas_criticos WHERE DATE(timestamp) = CURRENT_DATE)
  FROM logs_auditoria_medica 
  WHERE DATE(timestamp) = CURRENT_DATE
  ON CONFLICT (data) DO UPDATE SET
    total_interacoes = EXCLUDED.total_interacoes,
    total_criticas = EXCLUDED.total_criticas,
    sucessos = EXCLUDED.sucessos,
    erros = EXCLUDED.erros,
    alertas_gerados = EXCLUDED.alertas_gerados,
    taxa_sucesso = ROUND((EXCLUDED.sucessos::DECIMAL / EXCLUDED.total_interacoes) * 100, 2),
    atualizado_em = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_metricas 
  AFTER INSERT ON logs_auditoria_medica
  FOR EACH ROW EXECUTE FUNCTION atualizar_metricas_diarias();

-- 8. FUNÇÃO PARA GERAR RELATÓRIOS
CREATE OR REPLACE FUNCTION relatorio_auditoria_periodo(
  data_inicio DATE,
  data_fim DATE
)
RETURNS TABLE (
  total_interacoes BIGINT,
  taxa_sucesso DECIMAL,
  total_alertas BIGINT,
  perguntas_criticas BIGINT,
  tempo_medio DECIMAL,
  erros_por_tipo JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_interacoes,
    ROUND((COUNT(*) FILTER (WHERE l.sucesso = true)::DECIMAL / COUNT(*)) * 100, 2) as taxa_sucesso,
    (SELECT COUNT(*) FROM alertas_criticos WHERE DATE(timestamp) BETWEEN data_inicio AND data_fim) as total_alertas,
    COUNT(*) FILTER (WHERE l.categoria = 'CRITICO') as perguntas_criticas,
    AVG(EXTRACT(EPOCH FROM l.timestamp - LAG(l.timestamp) OVER (ORDER BY l.timestamp)))::DECIMAL(8,2) as tempo_medio,
    (
      SELECT jsonb_object_agg(tipo_pergunta, cnt)
      FROM (
        SELECT tipo_pergunta, COUNT(*) as cnt
        FROM logs_auditoria_medica 
        WHERE DATE(timestamp) BETWEEN data_inicio AND data_fim
          AND sucesso = false
        GROUP BY tipo_pergunta
      ) erros
    ) as erros_por_tipo
  FROM logs_auditoria_medica l
  WHERE DATE(l.timestamp) BETWEEN data_inicio AND data_fim;
END;
$$ LANGUAGE plpgsql;

-- COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE logs_auditoria_medica IS 'Log completo de todas as interações do agente médico';
COMMENT ON TABLE metricas_diarias IS 'Métricas agregadas diárias para dashboard executivo';
COMMENT ON TABLE alertas_criticos IS 'Alertas de problemas críticos que requerem atenção imediata';
COMMENT ON TABLE validacoes_detalhadas IS 'Detalhes de cada validação realizada pelo sistema';
COMMENT ON TABLE config_sistema_auditoria IS 'Configurações do sistema de auditoria médica';

-- VERIFICAÇÃO FINAL
SELECT 'Infraestrutura de auditoria médica criada com sucesso!' as status;