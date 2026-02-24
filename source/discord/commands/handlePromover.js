const robloxService = require('../services/robloxService');

/**
 * Handler do comando /promover
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handlePromover(interaction, ceobDb) {
    await interaction.deferReply();

    const executorDiscordId = interaction.user.id;
    const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

    if (!executorMilitar) {
        return interaction.editReply('❌ Você não possui cadastro no sistema ou está inativo.');
    }

    // 1. Verificar se o executor é Oficial (ordem_precedencia <= 11)
    if (executorMilitar.ordem_precedencia > 11) {
        return interaction.editReply('❌ Apenas Oficiais podem utilizar este comando.');
    }

    const isAltoComando = await ceobDb.permissoes.isAltoComando(executorMilitar.id);

    // 2. Capturar parâmetros
    const alvoInput = interaction.options.getString('alvo_identificador').trim();
    const novaPatenteAbrev = interaction.options.getString('nova_patente').toUpperCase();
    const robloxRoleId = interaction.options.getString('roblox_role_id').trim();

    try {
        // 3. Resolver ID do Roblox e buscar alvo
        let robloxId = alvoInput;

        // Se o input não for numérico, tenta buscar o Militar pelo Discord ID (ex: <@123>)
        const discordIdMatch = alvoInput.match(/<@!?(\d+)>/) || alvoInput.match(/^(\d{17,19})$/);
        let alvoMilitar = null;

        if (discordIdMatch) {
            alvoMilitar = await ceobDb.militares.getByDiscord(discordIdMatch[1]);
        } else {
            // Se for numero (ID) ou username, usar robloxService
            const { userId } = await robloxService.resolverUsuario(alvoInput);
            robloxId = userId;
            alvoMilitar = await ceobDb.militares.getByRoblox(robloxId);
        }

        if (!alvoMilitar) {
            return interaction.editReply('❌ Militar não encontrado ou se encontra inativo/excluído no sistema.');
        }

        if (alvoMilitar.id === executorMilitar.id) {
            return interaction.editReply('❌ Você não pode promover a si mesmo.');
        }

        // 4. Buscar a nova patente
        const novaPatente = await ceobDb.patentes.getByAbreviacao(novaPatenteAbrev);

        if (!novaPatente) {
            return interaction.editReply(`❌ Patente \`${novaPatenteAbrev}\` não encontrada no sistema.`);
        }

        // 5. Validações de Regra de Negócio
        // a) Nova patente deve ser superior à atual (menor ordem de precedencia = maior rank)
        if (novaPatente.ordem_precedencia >= alvoMilitar.ordem_precedencia) {
            return interaction.editReply(`❌ Promoção inválida. A nova patente (${novaPatente.nome}) deve ser hierarquicamente superior à patente atual (${alvoMilitar.patente_nome}).`);
        }

        // b) Executor não pode promover para patente igual ou superior à sua própria
        if (novaPatente.ordem_precedencia <= executorMilitar.ordem_precedencia) {
            return interaction.editReply(`❌ Você não pode promover o militar para uma patente igual ou superior à sua própria patente (${executorMilitar.patente_nome}).`);
        }

        // c) Promoções de Coronel para General (ordem <= 4) são manuais
        if (novaPatente.ordem_precedencia <= 4) {
            return interaction.editReply(`❌ Promoções para Oficiais-Generais são feitas apenas em solenidade formal de forma manual e não podem ser realizadas por este comando.`);
        }

        // d) Somente Alto Comando pode promover para Oficial (ordem <= 11)
        if (novaPatente.ordem_precedencia <= 11 && !isAltoComando) {
            return interaction.editReply(`❌ Apenas membros do Alto Comando podem promover militares ao oficialato.`);
        }

        // 6. Atualizar Roblox
        try {
            await robloxService.promoverMembro(alvoMilitar.roblox_user_id, robloxRoleId);
        } catch (err) {
            console.error('Erro na integração com Roblox:', err);
            return interaction.editReply(`❌ **Falha ao atualizar o cargo no Roblox do militar:** ${err.message}\n` +
                `A promoção no banco de dados **NÃO** foi registrada para evitar inconsistências. Corrija o ID da Role e tente novamente.`);
        }

        // 7. Atualizar Banco de Dados
        await ceobDb.militares.atualizarPatente(alvoMilitar.id, novaPatente.id);

        // 8. Registrar na Timeline
        await ceobDb.timeline.registrarEvento({
            militarId: alvoMilitar.id,
            tipoEvento: 'PROMOCAO',
            descricao: `Promovido de ${alvoMilitar.patente_nome} para ${novaPatente.nome} por ${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}.`,
            executadoPorId: executorMilitar.id
        });

        // 9. Enviar Boletim Eletrônico
        const embed = {
            title: `🎖️ Boletim de Promoção — ${alvoMilitar.nome_guerra}`,
            description: `O Exército Brasileiro tem a honra de anunciar a promoção do militar **${alvoMilitar.nome_guerra}**.`,
            color: 0x4CAF50, // Verde
            fields: [
                { name: '👤 Militar', value: `<@${alvoMilitar.discord_user_id}>`, inline: true },
                { name: '🎖️ Patente Anterior', value: `${alvoMilitar.patente_nome} (${alvoMilitar.patente_abrev})`, inline: true },
                { name: '🌟 Nova Patente', value: `${novaPatente.nome} (${novaPatente.abreviacao})`, inline: true },
                { name: '✍️ Promovido Por', value: `${executorMilitar.patente_nome} ${executorMilitar.nome_guerra}`, inline: true },
                { name: '🏛️ OM', value: alvoMilitar.om_sigla || 'N/A', inline: true }
            ],
            footer: { text: 'DGP — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        const canalBoletimId = process.env.BOLETIM_CANAL_PROMOCOES;

        if (canalBoletimId) {
            try {
                const canalDeBoletins = await interaction.client.channels.fetch(canalBoletimId);
                await canalDeBoletins.send({ embeds: [embed] });
            } catch (err) {
                console.error('Erro ao enviar mensagem para o canal de promoções:', err);
            }
        }

        return interaction.editReply({
            content: `✅ O militar **${alvoMilitar.nome_guerra}** foi promovido com sucesso para **${novaPatente.nome}** no Banco de Dados e no Roblox!${!canalBoletimId ? '\n*(Aviso: BOLETIM_CANAL_PROMOCOES não configurado, o anúncio não foi enviado.)*' : ''}`,
            embeds: [embed]
        });

    } catch (error) {
        console.error('Erro no comando promover:', error);
        if (error.name === 'RobloxError') {
            return interaction.editReply(`❌ **Erro no Roblox:** ${error.message}`);
        }
        return interaction.editReply('❌ Ocorreu um erro interno ao processar a promoção.');
    }
}

module.exports = handlePromover;
