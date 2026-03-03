const { SlashCommandBuilder } = require('discord.js');

/**
 * Retorna todas as definições de slash commands em formato JSON.
 * @returns {Object[]}
 */
function getSlashCommands() {
    return [
        new SlashCommandBuilder()
            .setName('ficha')
            .setDescription('Consulta a ficha de um militar')
            .addStringOption(opt =>
                opt.setName('identificador')
                    .setDescription('Matrícula, ID numérico do Roblox ou @Usuário do Discord')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('patentes')
            .setDescription('Lista todas as patentes da hierarquia'),

        new SlashCommandBuilder()
            .setName('oms')
            .setDescription('Lista todas as Organizações Militares ativas'),

        new SlashCommandBuilder()
            .setName('listagem')
            .setDescription('Retorna uma lista de todos os membros ATIVOS'),

        new SlashCommandBuilder()
            .setName('efetivo')
            .setDescription('Mostra o efetivo de uma OM')
            .addStringOption(opt =>
                opt.setName('sigla')
                    .setDescription('Sigla da OM (ex: COTER, DGP, PE)')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('minhaperfil')
            .setDescription('Exibe sua própria ficha militar'),

        new SlashCommandBuilder()
            .setName('listar_recrutamento')
            .setDescription('Lista e aprova imediatamente o ingresso de um recruta (Exclusivo DGP/AC)')
            .addStringOption(opt =>
                opt.setName('nome_guerra')
                    .setDescription('Nome de Guerra do militar')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('roblox_id')
                    .setDescription('ID da conta do Roblox (Apenas números)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('om')
                    .setDescription('Sigla da OM de destino (ex: COTER, DGP)')
                    .setRequired(true)
            )
            .addUserOption(opt =>
                opt.setName('usuario')
                    .setDescription('Usuário do Discord (Opcional, porém recomendado)')
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName('requerer_recrutamento')
            .setDescription('Solicitação de ingresso de um recruta, para verificação do DGP (Patente >= Cabo)')
            .addStringOption(opt =>
                opt.setName('nome_guerra')
                    .setDescription('Nome de Guerra do recruta')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('roblox')
                    .setDescription('Nome de usuário ou ID numérico do Roblox')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('observacao')
                    .setDescription('Observação sobre o recruta')
                    .setRequired(true)
            )
            .addUserOption(opt =>
                opt.setName('usuario')
                    .setDescription('Usuário do Discord (Opcional, porém recomendado)')
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName('apagar_militar')
            .setDescription('Apaga fisicamente um militar do sistema. APENAS MEMBROS DO COMANDO SUPREMO.')
            .addStringOption(opt =>
                opt.setName('roblox_id')
                    .setDescription('ID da conta do Roblox do alvo (Apenas números)')
                    .setRequired(false)
            )
            .addUserOption(opt =>
                opt.setName('discord_user')
                    .setDescription('Menção ou Usuário do Discord alvo')
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName('listar_militar')
            .setDescription('Lista diretamente um militar com patente específica (Exclusivo DGP/AC)')
            .addStringOption(opt =>
                opt.setName('nome_guerra')
                    .setDescription('Nome de Guerra do militar')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('patente')
                    .setDescription('Abreviação da patente (ex: SD, CB, 3 SGT, CAP)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('om')
                    .setDescription('Sigla da OM de destino (ex: COTER, DGP, PE)')
                    .setRequired(true)
            )
            .addUserOption(opt =>
                opt.setName('usuario')
                    .setDescription('Usuário do Discord do militar (OBRIGATÓRIO)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('roblox_id')
                    .setDescription('ID da conta do Roblox (Apenas números)')
                    .setRequired(false)
            )
            .addStringOption(opt =>
                opt.setName('roblox_username')
                    .setDescription('Username/Nick da conta do Roblox')
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName('requerimento_listagem')
            .setDescription('Solicita o próprio ingresso no CEOB (Para usuários não listados)')
            .addStringOption(opt =>
                opt.setName('roblox_username')
                    .setDescription('Seu Username (Nick) exato no Roblox')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('nome_guerra')
                    .setDescription('O Nome de Guerra que você irá utilizar')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('patente')
                    .setDescription('Abreviação da patente solicitada (ex: SD, CB, 3 SGT)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('om')
                    .setDescription('Sigla da OM desejada (ex: PE, 1º BI, COTER)')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('criar_om')
            .setDescription('Cria uma nova Organização Militar. APENAS MEMBROS DO COMANDO SUPREMO.')
            .addStringOption(opt =>
                opt.setName('nome')
                    .setDescription('Nome completo da OM (ex: 5º Batalhão de Infantaria Leve)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('sigla')
                    .setDescription('Sigla da OM (ex: 5º BIL)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('tipo')
                    .setDescription('Tipo da OM')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Comando Supremo', value: 'COMANDO_SUPREMO' },
                        { name: 'Órgão Consultivo', value: 'ORGAO_CONSULTIVO' },
                        { name: 'Estado Maior', value: 'ESTADO_MAIOR' },
                        { name: 'Comando Operacional', value: 'COMANDO_OPERACIONAL' },
                        { name: 'Departamento', value: 'DEPARTAMENTO' },
                        { name: 'Justiça', value: 'JUSTICA' },
                        { name: 'OM Especial', value: 'OM_ESPECIAL' },
                        { name: 'OM Subordinada', value: 'OM_SUBORDINADA' }
                    )
            )
            .addStringOption(opt =>
                opt.setName('parent_sigla')
                    .setDescription('Sigla da OM superior à qual esta será subordinada (Opcional)')
                    .setRequired(false)
            )
            .addIntegerOption(opt =>
                opt.setName('efetivo_maximo')
                    .setDescription('Efetivo máximo da OM (Opcional)')
                    .setRequired(false)
            )
            .addStringOption(opt =>
                opt.setName('descricao')
                    .setDescription('Descrição da OM (Opcional)')
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName('deletar_om')
            .setDescription('Deleta (desativa) uma Organização Militar. APENAS MEMBROS DO COMANDO SUPREMO.')
            .addStringOption(opt =>
                opt.setName('sigla')
                    .setDescription('Sigla da OM a ser deletada (ex: 5º BIL)')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('promover')
            .setDescription('Promove um militar do CEOB (Requer Oficialato)')
            .addStringOption(opt =>
                opt.setName('alvo_identificador')
                    .setDescription('ID do Roblox ou ID do Discord do alvo')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('nova_patente')
                    .setDescription('Abreviação da nova patente (ex: CB, 3 SGT, TEN)')
                    .setRequired(true)
            )
            .addIntegerOption(opt =>
                opt.setName('roblox_rank')
                    .setDescription('Número do Rank no grupo do Roblox da nova patente (1-255)')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('rebaixar')
            .setDescription('Rebaixa um militar do CEOB (Requer Oficialato)')
            .addStringOption(opt =>
                opt.setName('alvo_identificador')
                    .setDescription('ID do Roblox ou ID do Discord do alvo')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('nova_patente')
                    .setDescription('Abreviação da nova patente (ex: SD, CB, ST)')
                    .setRequired(true)
            )
            .addIntegerOption(opt =>
                opt.setName('roblox_rank')
                    .setDescription('Número do Rank no grupo do Roblox da nova patente (1-255)')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('desligar')
            .setDescription('Desliga um militar do CEOB (Demissão, Exoneração, Exclusão ou Reforma)')
            .addStringOption(opt =>
                opt.setName('alvo_identificador')
                    .setDescription('ID do Roblox, @Discord ou Username do alvo')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('tipo')
                    .setDescription('Tipo de desligamento')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Demissão a Pedido', value: 'DEMISSAO_PEDIDO' },
                        { name: 'Exoneração', value: 'EXONERACAO' },
                        { name: 'Exclusão', value: 'EXCLUSAO' },
                        { name: 'Reforma', value: 'REFORMA' }
                    )
            )
            .addStringOption(opt =>
                opt.setName('motivo')
                    .setDescription('Motivo do desligamento')
                    .setRequired(true)
            ),
        new SlashCommandBuilder()
            .setName('transferir_militar')
            .setDescription('Transfere um militar de OM (Exclusivo DGP/AC)')
            .addStringOption(opt =>
                opt.setName('matricula')
                    .setDescription('Matrícula do militar a ser transferido')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('om_alvo')
                    .setDescription('Sigla da OM destino')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('motivo')
                    .setDescription('Motivo da transferência')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('transferencia_requerimento')
            .setDescription('Solicita transferência para outra OM')
            .addStringOption(opt =>
                opt.setName('roblox')
                    .setDescription('Nome de usuário ou ID numérico do Roblox')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('om_alvo')
                    .setDescription('Sigla da OM pretendida')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('motivo')
                    .setDescription('Motivo da solicitação de transferência')
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('funcao')
            .setDescription('Gerencia e atribui funções militares por OM')
            // SUBCOMANDO: CRIAR
            .addSubcommand(sub => sub
                .setName('criar')
                .setDescription('Cria uma nova função para uma OM')
                .addStringOption(opt =>
                    opt.setName('nome')
                        .setDescription('Nome da função (ex: Comandante de Pelotão)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('om')
                        .setDescription('Sigla da OM a qual pertence (ex: 1º BI, PE)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('descricao')
                        .setDescription('Descrição opcional da função')
                        .setRequired(false)
                )
            )
            // SUBCOMANDO: DELETAR
            .addSubcommand(sub => sub
                .setName('deletar')
                .setDescription('Desativa permanentemente uma função da OM')
                .addStringOption(opt =>
                    opt.setName('nome_funcao')
                        .setDescription('Nome exato da função a ser deletada')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('om')
                        .setDescription('Sigla da OM à qual a função pertence')
                        .setRequired(true)
                )
            )
            // SUBCOMANDO: NOMEAR
            .addSubcommand(sub => sub
                .setName('nomear')
                .setDescription('Nomeia um militar para uma função da OM')
                .addStringOption(opt =>
                    opt.setName('militar_identificador')
                        .setDescription('Nome de Guerra, @Discord ou ID Roblox do militar')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('om')
                        .setDescription('Sigla da OM')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('nome_funcao')
                        .setDescription('Nome exato da função desejada')
                        .setRequired(true)
                )
            )
            // SUBCOMANDO: EXONERAR
            .addSubcommand(sub => sub
                .setName('exonerar')
                .setDescription('Exonera um militar de uma função na OM')
                .addStringOption(opt =>
                    opt.setName('militar_identificador')
                        .setDescription('Nome de Guerra, @Discord ou ID Roblox do militar')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('om')
                        .setDescription('Sigla da OM')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('nome_funcao')
                        .setDescription('Nome exato da função da qual ele será exonerado')
                        .setRequired(true)
                )
            ),

        new SlashCommandBuilder()
            .setName('curso')
            .setDescription('Gerencia o sistema de cursos')
            .addSubcommand(sub => sub
                .setName('aplicar')
                .setDescription('Aplica um curso de formação (CFC ou CFSd)')
                .addStringOption(opt =>
                    opt.setName('curso')
                        .setDescription('Curso a ser aplicado (CFC ou CFSd)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addUserOption(opt =>
                    opt.setName('coordenador')
                        .setDescription('Oficial coordenador do curso')
                        .setRequired(true)
                )
                .addUserOption(opt =>
                    opt.setName('auxiliar')
                        .setDescription('Auxiliar do instrutor (opcional)')
                        .setRequired(false)
                )
            ),

        new SlashCommandBuilder()
            .setName('catalogo')
            .setDescription('Gerencia o catálogo de cursos institucionais')
            // SUBCOMANDO: CRIAR
            .addSubcommand(sub => sub
                .setName('criar')
                .setDescription('Registra um novo curso referencial no catálogo institucional')
                .addStringOption(opt =>
                    opt.setName('nome')
                        .setDescription('Nome completo do curso (ex: Curso de Formação de Sargentos)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('sigla')
                        .setDescription('Sigla única do curso (ex: CFS)')
                        .setRequired(true)
                )
            )
            // SUBCOMANDO: LISTAR
            .addSubcommand(sub => sub
                .setName('listar')
                .setDescription('Exibe o portfólio completo de cursos do catálogo')
                .addBooleanOption(opt =>
                    opt.setName('mostrar_arquivados')
                        .setDescription('Se verdadeiro, inclui cursos inativos na listagem')
                        .setRequired(false)
                )
            )
            // SUBCOMANDO: ARQUIVAR
            .addSubcommand(sub => sub
                .setName('arquivar')
                .setDescription('Desativa um curso do catálogo (soft-delete)')
                .addStringOption(opt =>
                    opt.setName('sigla')
                        .setDescription('Sigla do curso a ser arquivado')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
            )
            // SUBCOMANDO: REATIVAR
            .addSubcommand(sub => sub
                .setName('reativar')
                .setDescription('Restaura um curso arquivado de volta ao catálogo')
                .addStringOption(opt =>
                    opt.setName('sigla')
                        .setDescription('Sigla do curso a ser reativado')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
            ),

        new SlashCommandBuilder()
            .setName('turma')
            .setDescription('Gerencia turmas de cursos institucionais')
            // SUBCOMANDO: ABRIR
            .addSubcommand(sub => sub
                .setName('abrir')
                .setDescription('Abre (instancia) uma nova turma de um curso ativo do catálogo')
                .addStringOption(opt =>
                    opt.setName('sigla_curso')
                        .setDescription('Sigla do curso (deve existir e estar ativo no catálogo)')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(opt =>
                    opt.setName('nome_turma')
                        .setDescription('Identificador/nome da turma (ex: Alfa, Bravo, Turma 1)')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('coordenador')
                        .setDescription('Matrícula, Roblox Nome ou ID do coordenador')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('om')
                        .setDescription('Sigla da OM vinculada à turma')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(opt =>
                    opt.setName('instrutor')
                        .setDescription('Matrícula, Roblox Nome ou ID do instrutor (opcional)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('auxiliar')
                        .setDescription('Matrícula, Roblox Nome ou ID do auxiliar (opcional)')
                        .setRequired(false)
                )
            )
            // SUBCOMANDO: INTEGRAR
            .addSubcommand(sub => sub
                .setName('integrar')
                .setDescription('Matricula ou finaliza alunos dentro de uma turma aberta')
                .addStringOption(opt =>
                    opt.setName('turma_id')
                        .setDescription('ID da turma em andamento ou planejada')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
            )
            // SUBCOMANDO: ENCERRAR
            .addSubcommand(sub => sub
                .setName('encerrar')
                .setDescription('Encerra e aprova oficialmente uma turma')
                .addStringOption(opt =>
                    opt.setName('turma_id')
                        .setDescription('ID da turma a ser encerrada')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(opt =>
                    opt.setName('motivo')
                        .setDescription('Motivo ou observação adicional do encerramento')
                        .setRequired(false)
                )
            )
            // SUBCOMANDO: GERENCIAR
            .addSubcommand(sub => sub
                .setName('gerenciar')
                .setDescription('Exibe a visão completa e interativa de uma turma')
                .addStringOption(opt =>
                    opt.setName('turma_id')
                        .setDescription('ID direto da turma a consultar')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
                .addStringOption(opt =>
                    opt.setName('sigla_curso')
                        .setDescription('Filtra turmas ativas por sigla do curso')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
            ),
    ].map(cmd => cmd.toJSON());
}

module.exports = getSlashCommands;
