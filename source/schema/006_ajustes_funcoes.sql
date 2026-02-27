-- Migração de correção: Adiciona a coluna om_id em bancos de dados que já possuíam a tabela "ceob.funcoes"

DO $$
BEGIN
    -- Verifica se a coluna om_id NÃO existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'ceob' AND table_name = 'funcoes' AND column_name = 'om_id'
    ) THEN
        -- Como a tabela já existia e a coluna vai ser NOT NULL, precisamos esvaziar a tabela primeiro
        -- (já que não faria sentido uma função com om_id nulo para o novo sistema)
        TRUNCATE TABLE ceob.militar_funcoes CASCADE;
        TRUNCATE TABLE ceob.funcoes CASCADE;

        -- Adiciona a coluna om_id agora exigindo NOT NULL
        ALTER TABLE ceob.funcoes 
            ADD COLUMN om_id INTEGER NOT NULL REFERENCES ceob.organizacoes_militares(id) ON DELETE CASCADE;

        -- Remove a constraint antiga (UNIQUE nome) se existir
        ALTER TABLE ceob.funcoes DROP CONSTRAINT IF EXISTS funcoes_nome_key;

        -- Adiciona a nova constraint composta
        ALTER TABLE ceob.funcoes ADD CONSTRAINT funcoes_nome_om_id_key UNIQUE (nome, om_id);
    END IF;
END $$;