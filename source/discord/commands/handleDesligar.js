const robloxService = require('../services/robloxService');

/**
 * Mapeamento: tipo de desligamento → evento de timeline + situação funcional.
 */
const TIPO_MAP = {
    'DEMISSAO_PEDIDO': { evento: 'DEMISSAO', situacao: 'RESERVA', label: 'Demissão a Pedido' },
    'EXONERACAO': { evento: 'EXONERACAO', situacao: 'RESERVA', label: 'Exoneração' },
    'EXCLUSAO': { evento: 'EXCLUSAO', situacao: 'EXCLUIDO', label: 'Exclusão' },
    'REFORMA': { evento: 'DEMISSAO', situacao: 'REFORMADO', label: 'Reforma' },
};

/**
 * Handler do comando /desligar
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleDesligar(interaction, ceobDb) {
    try {
        await interaction.deferReply();

        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema ou está inativo.');
        }

        // 1. Capturar parâmetros
        const alvoInput = interaction.options.getString('alvo_identificador').trim();
        const tipo = interaction.options.getString('tipo');
        const motivo = interaction.options.getString('motivo');
        const tipoInfo = TIPO_MAP[tipo];

        if (!tipoInfo) {
            return interaction.editReply('❌ Tipo de desligamento inválido.');
        }

        // 2. Resolver alvo
        let alvoMilitar = null;
        const discordIdMatch = alvoInput.match(/<@!?(\d+)>/) || alvoInput.match(/^(\d{17,19})$/);

        if (discordIdMatch) {
            alvoMilitar = await ceobDb.militares.getByDiscord(discordIdMatch[1]);
        } else {
            const { userId } = await robloxService.resolverUsuario(alvoInput);
            alvoMilitar = await ceobDb.militares.getByRoblox(userId);
        }

        if (!alvoMilitar) {
            return interaction.editReply('❌ Militar não encontrado ou se encontra inativo/excluído no sistema.');
        }

        // 3. Verificação de permissão
        const isAutoDesligamento = (alvoMilitar.id === executorMilitar.id) && tipo === 'DEMISSAO_PEDIDO';

        if (isAutoDesligamento) {
            // Demissão a Pedido (executor === alvo): permitido para QUALQUER patente
        } else {
            if (executorMilitar.ordem_precedencia > 11) {
                return interaction.editReply('❌ Apenas Oficiais podem utilizar este comando para desligar outros militares.');
            }

            if (alvoMilitar.id === executorMilitar.id) {
                return interaction.editReply('❌ Você só pode desligar a si mesmo através da **Demissão a Pedido**.');
            }

            if (alvoMilitar.ordem_precedencia <= executorMilitar.ordem_precedencia) {
                return interaction.editReply(`❌ Você não pode desligar um militar de patente igual ou superior à sua (${alvoMilitar.patente_nome}).`);
            }

            const isAltoComando = await ceobDb.permissoes.isAltoComando(executorMilitar.id);
            if (alvoMilitar.ordem_precedencia <= 11 && !isAltoComando) {
                return interaction.editReply('❌ Apenas membros do Alto Comando podem desligar Oficiais.');
            }
        }

        // 4. Integração Roblox — remover do(s) grupo(s)
        let robloxResultado = null;
        try {
            robloxResultado = await robloxService.removerDeGrupos(
                alvoMilitar.roblox_user_id,
                alvoMilitar.om_sigla
            );
        } catch (err) {
            console.error('Erro na integração com Roblox (Desligamento):', err);
            return interaction.editReply(
                `❌ **Falha ao remover o militar do(s) grupo(s) do Roblox:** ${err.message}\n` +
                `O desligamento no banco de dados **NÃO** foi registrado para evitar inconsistências.`
            );
        }

        // 5. Exonerar todas as funções ativas
        const funcoesExoneradas = await ceobDb.funcoes.exonerarTodas(alvoMilitar.id);

        // 6. Desligar no banco de dados
        await ceobDb.militares.desligar(alvoMilitar.id, tipoInfo.situacao);

        // 7. Registrar na Timeline
        const descricaoTimeline = isAutoDesligamento
            ? `Desligado por Demissão a Pedido (auto-desligamento). Motivo: "${motivo}"`
            : `Desligado por ${tipoInfo.label} por ${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}. Motivo: "${motivo}"`;

        await ceobDb.timeline.registrarEvento({
            militarId: alvoMilitar.id,
            tipoEvento: tipoInfo.evento,
            descricao: descricaoTimeline,
            executadoPorId: executorMilitar.id,
            dadosExtras: {
                tipo_desligamento: tipo,
                situacao_final: tipoInfo.situacao,
                funcoes_exoneradas: funcoesExoneradas.length,
                roblox: robloxResultado?.resultados || []
            }
        });

        // 8. Boletim Eletrônico
        const corEmbed = tipo === 'EXCLUSAO' ? 0xE53935
            : tipo === 'REFORMA' ? 0x9E9E9E
                : 0xFF9800;

        const embed = {
            title: `📋 Boletim de ${tipoInfo.label} — ${alvoMilitar.nome_guerra}`,
            description: isAutoDesligamento
                ? `O militar **${alvoMilitar.nome_guerra}** solicitou seu próprio desligamento por Demissão a Pedido.`
                : `Foi determinado o desligamento do militar **${alvoMilitar.nome_guerra}** por **${tipoInfo.label}**.`,
            color: corEmbed,
            fields: [
                { name: '👤 Militar', value: `<@${alvoMilitar.discord_user_id}>`, inline: true },
                { name: '🎖️ Patente', value: `${alvoMilitar.patente_nome} (${alvoMilitar.patente_abrev})`, inline: true },
                { name: '📌 Tipo', value: tipoInfo.label, inline: true },
                { name: '🏷️ Situação Final', value: tipoInfo.situacao, inline: true },
                { name: '🏛️ OM', value: alvoMilitar.om_sigla || 'N/A', inline: true },
                {
                    name: '✍️ Desligado Por', value: isAutoDesligamento
                        ? 'Próprio militar (a pedido)'
                        : `${executorMilitar.patente_nome} ${executorMilitar.nome_guerra}`, inline: true
                },
                { name: '📝 Motivo', value: motivo, inline: false }
            ],
            footer: { text: 'DGP — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        if (funcoesExoneradas.length > 0) {
            embed.fields.push({
                name: '⚙️ Funções Exoneradas',
                value: `${funcoesExoneradas.length} função(ões) exonerada(s) automaticamente.`,
                inline: false
            });
        }

        const canalBoletimId = process.env.BOLETIM_EXONERACOES;

        if (canalBoletimId) {
            try {
                const canalDeBoletins = await interaction.client.channels.fetch(canalBoletimId);
                await canalDeBoletins.send({ embeds: [embed] });
            } catch (err) {
                console.error('Erro ao enviar mensagem para o canal de exonerações:', err);
            }
        }

        return interaction.editReply({
            content: `✅ O militar **${alvoMilitar.nome_guerra}** foi desligado com sucesso!\n` +
                `• **Tipo:** ${tipoInfo.label}\n` +
                `• **Situação Final:** ${tipoInfo.situacao}\n` +
                `• **Funções Exoneradas:** ${funcoesExoneradas.length}` +
                `${!canalBoletimId ? '\n*(Aviso: BOLETIM_EXONERACOES não configurado, o anúncio não foi enviado.)*' : ''}`,
            embeds: [embed]
        });

    } catch (error) {
        console.error('Erro no comando desligar:', error);
        const msg = error.name === 'RobloxError' ? `❌ **Erro no Roblox:** ${error.message}` : '❌ Ocorreu um erro interno ao processar o desligamento.';
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(msg);
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleDesligar;
