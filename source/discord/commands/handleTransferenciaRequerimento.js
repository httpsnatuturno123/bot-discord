/**
 * Handler do comando /transferencia_requerimento
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */

const robloxService = require('../services/robloxService');

async function handleTransferenciaRequerimento(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // 1. Resolve o Roblox fornecido
        const robloxInput = interaction.options.getString('roblox');
        let robloxUserId = null;
        let robloxUsername = null;
        try {
            const resultado = await robloxService.resolverUsuario(robloxInput);
            robloxUserId = resultado.userId;
            robloxUsername = resultado.username;
        } catch (err) {
            if (err.name === 'RobloxError') {
                return interaction.editReply(`❌ **Bloqueado:** ${err.message}`);
            }
            return interaction.editReply('❌ **Falha de Comunicação:** O bot não conseguiu se conectar aos servidores do Roblox para validar o usuário.');
        }

        // 2. Valida o militar
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByRoblox(robloxUserId);

        if (!executorMilitar) {
            return interaction.editReply(`❌ O usuário Roblox **${robloxUsername}** não possui cadastro no sistema como militar ativo.`);
        }

        if (!executorMilitar.ativo || executorMilitar.situacao_funcional === 'EXCLUIDO') {
            return interaction.editReply('❌ Militares inativos não podem solicitar transferência.');
        }

        // 2. Obtém argumentos
        const omAlvoSigla = interaction.options.getString('om_alvo');
        const motivo = interaction.options.getString('motivo');

        // 3. Busca a OM de destino
        const omRows = await ceobDb.connection.query(`SELECT id, nome, sigla FROM ceob.organizacoes_militares WHERE sigla = $1 AND ativo = true`, [omAlvoSigla]);
        const omDestino = omRows.rows[0];

        if (!omDestino) {
            return interaction.editReply(`❌ Organização Militar de destino com sigla **${omAlvoSigla}** não encontrada ou inativa.`);
        }

        if (executorMilitar.om_lotacao_id === omDestino.id) {
            return interaction.editReply(`❌ Você já está lotado na OM **${omDestino.sigla}**.`);
        }

        // 4. Busca a OM atual para exibir
        const omAtualRows = await ceobDb.connection.query(`SELECT id, sigla, nome FROM ceob.organizacoes_militares WHERE id = $1`, [executorMilitar.om_lotacao_id]);
        const omAtual = omAtualRows.rows[0];
        const omAtualSigla = omAtual ? omAtual.sigla : 'Sem OM';

        // 5. Verifica se já existe um requerimento de transferência pendente
        const reqPendenteRows = await ceobDb.connection.query(
            `SELECT id FROM ceob.requerimentos 
             WHERE tipo = 'TRANSFERENCIA' 
               AND solicitante_id = $1 
               AND status IN ('PENDENTE', 'EM_ANALISE')`,
            [executorMilitar.id]
        );

        if (reqPendenteRows.rows.length > 0) {
            return interaction.editReply('❌ Você já possui um requerimento de transferência pendente de análise.');
        }

        // 6. Insere o requerimento
        const dadosExtras = {
            omOrigemId: executorMilitar.om_lotacao_id,
            omOrigemSigla: omAtualSigla,
            omDestinoId: omDestino.id,
            omDestinoSigla: omDestino.sigla,
            motivo: motivo,
            robloxUsername: executorMilitar.roblox_username,
            robloxId: executorMilitar.roblox_user_id
        };

        const requerimento = await ceobDb.requerimentos.criar({
            tipo: 'TRANSFERENCIA',
            solicitanteId: executorMilitar.id,
            militarAlvoId: executorMilitar.id, // Ele mesmo
            orgaoResponsavelId: omDestino.id, // OMT de destino
            motivoSolicitacao: motivo,
            dadosExtras: dadosExtras,
            isListagem: false
        });

        // 7. Resposta do Discord (Embed para o usuário)
        const embedUsuario = {
            title: `📋 Requerimento de Transferência Enviado`,
            description: `Sua solicitação para transferência de **${omAtualSigla}** para **${omDestino.sigla}** foi submetida e será analisada pela DGP/Comando.`,
            color: 0xE9C46A,
            fields: [
                { name: '🏢 OM Pretendida', value: `**${omDestino.sigla}**`, inline: true },
                { name: '🏢 OM Atual', value: `**${omAtualSigla}**`, inline: true },
                { name: '📝 Motivo', value: motivo, inline: false },
                { name: '🆔 Protocolo', value: `#${requerimento.id}`, inline: false }
            ],
            footer: { text: 'Aguardando Análise' },
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embedUsuario] });

        // 8. Envia para o canal de transferências da DGP
        const canalDGPId = process.env.DISCORD_TRANSFERENCIAS;
        if (canalDGPId) {
            try {
                const canalTransferencias = await interaction.client.channels.fetch(canalDGPId);

                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                const botoes = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`reqtransf_aprovar_${requerimento.id}`)
                        .setLabel('Aprovar')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`reqtransf_recusar_${requerimento.id}`)
                        .setLabel('Indeferir')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );

                const embedDGP = {
                    title: `📥 Solicitação de Transferência #${requerimento.id}`,
                    description: `**Militar:** <@${executorDiscordId}> (${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra})\n**Tipo:** TRANSFERÊNCIA`,
                    color: 0xE9C46A,
                    fields: [
                        { name: '🎮 Roblox (Usuário | ID)', value: `${executorMilitar.roblox_username} | ${executorMilitar.roblox_user_id}`, inline: false },
                        { name: '🏢 OM Anterior', value: `**${omAtualSigla}**`, inline: true },
                        { name: '🏢 OM Pretendida', value: `**${omDestino.sigla}**`, inline: true },
                        { name: '📝 Motivo', value: motivo, inline: false }
                    ],
                    footer: { text: `Comandante da ${omDestino.sigla} ou DGP podem julgar` },
                    timestamp: new Date()
                };

                await canalTransferencias.send({ embeds: [embedDGP], components: [botoes] });
            } catch (err) {
                console.error("Erro ao enviar no canal de transferências da DGP:", err);
            }
        }

    } catch (error) {
        console.error('Erro na solicitação de transferência:', error);
        await interaction.editReply('❌ Ocorreu um erro interno ao processar sua solicitação.');
    }
}

module.exports = handleTransferenciaRequerimento;
