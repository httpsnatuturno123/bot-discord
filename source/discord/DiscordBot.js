const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

// Definições de comandos
const getSlashCommands = require('./commands/commandDefinitions');

// Handlers de Slash Commands
const handleFicha = require('./commands/handleFicha');
const handlePatentes = require('./commands/handlePatentes');
const handleOMs = require('./commands/handleOMs');
const handleEfetivo = require('./commands/handleEfetivo');
const handleMinhaPerfil = require('./commands/handleMinhaPerfil');
const handleListarRecrutamento = require('./commands/handleListarRecrutamento');
const handleRequererRecrutamento = require('./commands/handleRequererRecrutamento');
const handleApagarMilitar = require('./commands/handleApagarMilitar');

// Handler legado (prefixo)
const handleBanLegado = require('./commands/handleBanLegado');

class DiscordBot {
    constructor(token, legacyDb, ceobDb) {
        this.token = token;
        this.legacyDb = legacyDb;
        this.ceobDb = ceobDb;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.setupEvents();
    }

    // ────────────────────────────────────────────────────
    // Registro dos Slash Commands
    // ────────────────────────────────────────────────────
    async registerCommands() {
        const rest = new REST({ version: '10' }).setToken(this.token);

        try {
            const commands = getSlashCommands();
            console.log(`🔄 Discord: Registrando ${commands.length} slash commands...`);

            if (process.env.DISCORD_GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(this.client.user.id, process.env.DISCORD_GUILD_ID),
                    { body: commands }
                );
                console.log(`✅ Discord: Slash commands registrados no servidor ${process.env.DISCORD_GUILD_ID}`);
            } else {
                await rest.put(
                    Routes.applicationCommands(this.client.user.id),
                    { body: commands }
                );
                console.log('✅ Discord: Slash commands registrados globalmente');
            }
        } catch (err) {
            console.error('❌ Discord: Erro ao registrar slash commands:', err);
        }
    }

    // ────────────────────────────────────────────────────
    // Mapa de comandos → handlers
    // ────────────────────────────────────────────────────
    getCommandMap() {
        return {
            'ficha': (i) => handleFicha(i, this.ceobDb),
            'patentes': (i) => handlePatentes(i, this.ceobDb),
            'oms': (i) => handleOMs(i, this.ceobDb),
            'efetivo': (i) => handleEfetivo(i, this.ceobDb),
            'minhaperfil': (i) => handleMinhaPerfil(i, this.ceobDb),
            'listar_recrutamento': (i) => handleListarRecrutamento(i, this.ceobDb),
            'requerer_recrutamento': (i) => handleRequererRecrutamento(i, this.ceobDb),
            'apagar_militar': (i) => handleApagarMilitar(i, this.ceobDb),
        };
    }

    // ────────────────────────────────────────────────────
    // Event Handlers
    // ────────────────────────────────────────────────────
    setupEvents() {
        this.client.once('ready', async () => {
            console.log(`✅ Discord: Bot logado como ${this.client.user.tag}`);
            await this.registerCommands();
        });

        // ── Interações (Slash Commands, Botões, Modais) ──
        this.client.on('interactionCreate', async (interaction) => {

            // ── Botões de Requerimento ──
            if (interaction.isButton()) {
                if (interaction.customId.startsWith('req_aprovar_') || interaction.customId.startsWith('req_recusar_')) {
                    try {
                        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

                        const isAprovacao = interaction.customId.startsWith('req_aprovar_');
                        const requerimentoId = interaction.customId.replace(isAprovacao ? 'req_aprovar_' : 'req_recusar_', '');
                        const acao = isAprovacao ? 'APROVAR' : 'INDEFERIR';

                        const modal = new ModalBuilder()
                            .setCustomId(`req_modal_${acao}_${requerimentoId}`)
                            .setTitle(isAprovacao ? `✅ Aprovar #${requerimentoId}` : `❌ Indeferir #${requerimentoId}`);

                        const motivoInput = new TextInputBuilder()
                            .setCustomId('motivo_decisao')
                            .setLabel('Justificativa / Motivo da Decisão')
                            .setPlaceholder('Escreva o motivo da aprovação ou indeferimento...')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                            .setMinLength(3)
                            .setMaxLength(1000);

                        modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
                        await interaction.showModal(modal);
                    } catch (err) {
                        console.error('❌ Erro ao exibir modal de requerimento:', err);
                    }
                }
                return;
            }

            // ── Modal de Justificativa do Requerimento ──
            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('req_modal_')) {
                    try {
                        const isAprovacao = interaction.customId.startsWith('req_modal_APROVAR_');
                        const requerimentoId = interaction.customId.replace(isAprovacao ? 'req_modal_APROVAR_' : 'req_modal_INDEFERIR_', '');
                        const statusFinal = isAprovacao ? 'APROVADO' : 'INDEFERIDO';

                        await interaction.deferReply({ ephemeral: true });

                        const motivoDecisao = interaction.fields.getTextInputValue('motivo_decisao');

                        // Valida o analista
                        const analistaDiscordId = interaction.user.id;
                        const analistaMilitar = await this.ceobDb.militares.getByDiscord(analistaDiscordId);

                        if (!analistaMilitar) {
                            return interaction.editReply('❌ Você não possui cadastro no sistema.');
                        }

                        // Atualiza o requerimento no banco
                        const reqAtualizado = await this.ceobDb.requerimentos.atualizar(requerimentoId, {
                            status: statusFinal,
                            analisadoPorId: analistaMilitar.id,
                            motivoDecisao: motivoDecisao,
                            timelineEventoId: null
                        });

                        if (!reqAtualizado) {
                            return interaction.editReply('❌ Requerimento não encontrado no banco de dados.');
                        }

                        // Busca dados do militar alvo para o boletim
                        let nomeMilitarAlvo = `ID #${reqAtualizado.militar_alvo_id}`;
                        let omSiglaAlvo = '';

                        // Busca militar alvo diretamente pelo ID
                        const { rows: alvoRows } = await this.ceobDb.connection.query(
                            `SELECT m.nome_guerra, m.matricula, om.sigla AS om_sigla
                             FROM ceob.militares m
                             JOIN ceob.organizacoes_militares om ON m.om_lotacao_id = om.id
                             WHERE m.id = $1`,
                            [reqAtualizado.militar_alvo_id]
                        );
                        if (alvoRows.length > 0) {
                            nomeMilitarAlvo = alvoRows[0].nome_guerra;
                            omSiglaAlvo = alvoRows[0].om_sigla;
                        }

                        // Se APROVADO, ativa o militar
                        if (isAprovacao) {
                            await this.ceobDb.connection.query(
                                `UPDATE ceob.militares SET ativo = true, updated_at = NOW() WHERE id = $1`,
                                [reqAtualizado.militar_alvo_id]
                            );
                        }

                        // Cria evento na Timeline
                        const tipoEvento = isAprovacao ? 'INGRESSO' : 'OBSERVACAO';
                        const descricaoTimeline = isAprovacao
                            ? `Ingresso no CEOB aprovado via Requerimento #${requerimentoId}. Justificativa: ${motivoDecisao}`
                            : `Requerimento de Ingresso #${requerimentoId} indeferido. Motivo: ${motivoDecisao}`;

                        const timelineEvento = await this.ceobDb.timeline.registrarEvento({
                            militarId: reqAtualizado.militar_alvo_id,
                            tipoEvento,
                            descricao: descricaoTimeline,
                            executadoPorId: analistaMilitar.id,
                            dadosExtras: { requerimento_id: requerimentoId, decisao: statusFinal }
                        });

                        // Atualiza o requerimento com o timeline_evento_id
                        await this.ceobDb.connection.query(
                            `UPDATE ceob.requerimentos SET timeline_evento_id = $1 WHERE id = $2`,
                            [timelineEvento.id, requerimentoId]
                        );

                        // Gera o Boletim Eletrônico
                        const boletimConteudo = isAprovacao
                            ? `**INGRESSO NO CEOB (Via Requerimento)**\nO recruta **${nomeMilitarAlvo}** teve seu ingresso aprovado e foi integrado à OM **${omSiglaAlvo}**.\n**Aprovado por:** ${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}\n**Justificativa:** ${motivoDecisao}`
                            : `**REQUERIMENTO INDEFERIDO**\nO requerimento de ingresso do recruta **${nomeMilitarAlvo}** foi indeferido.\n**Indeferido por:** ${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}\n**Motivo:** ${motivoDecisao}`;

                        const boletim = await this.ceobDb.boletim.criar({
                            conteudo: boletimConteudo,
                            requerimentoId: parseInt(requerimentoId),
                            timelineEventoId: timelineEvento.id
                        });

                        // Envia o boletim para o canal configurado
                        const canalBoletimId = process.env.CANAL_BOLETIM_ID;
                        if (canalBoletimId) {
                            try {
                                const canalDeBoletins = await interaction.client.channels.fetch(canalBoletimId);

                                const corBoletim = isAprovacao ? 0x2ECC71 : 0xE74C3C;
                                const tituloBoletim = isAprovacao
                                    ? `📄 Boletim Interno — ${boletim.numero} (Aprovação)`
                                    : `📄 Boletim Interno — ${boletim.numero} (Indeferimento)`;

                                const embedBoletim = {
                                    title: tituloBoletim,
                                    description: boletimConteudo,
                                    color: corBoletim,
                                    fields: [
                                        { name: '🆔 Protocolo', value: `#${requerimentoId}`, inline: true },
                                        { name: '🎖️ Recruta', value: nomeMilitarAlvo, inline: true },
                                        { name: '✍️ Analisado por', value: `${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}`, inline: true }
                                    ],
                                    footer: { text: 'DGP — Departamento Geral do Pessoal' },
                                    timestamp: new Date()
                                };

                                const msgBoletim = await canalDeBoletins.send({ embeds: [embedBoletim] });

                                // Atualiza o boletim com o ID da mensagem do Discord
                                await this.ceobDb.connection.query(
                                    `UPDATE ceob.boletim_eletronico SET discord_message_id = $1 WHERE id = $2`,
                                    [msgBoletim.id, boletim.id]
                                );
                            } catch (errBoletim) {
                                console.error('❌ Erro ao enviar boletim para o canal:', errBoletim);
                            }
                        }

                        // Atualiza a embed original (remove os botões e muda a cor)
                        const corEmbed = isAprovacao ? 0x2ECC71 : 0xE74C3C;
                        const statusTexto = isAprovacao ? '✅ APROVADO' : '❌ INDEFERIDO';

                        const embedOriginal = interaction.message.embeds[0];
                        const embedAtualizado = {
                            ...embedOriginal.data,
                            color: corEmbed,
                            footer: { text: `${statusTexto} por ${analistaMilitar.patente_abrev} ${analistaMilitar.nome_guerra}` },
                            fields: [
                                ...embedOriginal.fields,
                                { name: '📋 Decisão', value: `**${statusTexto}**`, inline: true },
                                { name: '💬 Justificativa', value: motivoDecisao, inline: false },
                                { name: '📄 Boletim', value: `${boletim.numero}`, inline: true }
                            ]
                        };

                        await interaction.message.edit({ embeds: [embedAtualizado], components: [] });

                        const msgConfirmacao = isAprovacao
                            ? `✅ Requerimento **#${requerimentoId}** aprovado. O militar foi ativado e o boletim **${boletim.numero}** foi publicado.`
                            : `❌ Requerimento **#${requerimentoId}** indeferido. O boletim **${boletim.numero}** foi publicado.`;

                        await interaction.editReply(msgConfirmacao);
                    } catch (err) {
                        console.error('❌ Erro ao processar decisão do requerimento:', err);
                        if (interaction.deferred || interaction.replied) {
                            await interaction.editReply('❌ Ocorreu um erro interno ao processar a decisão.');
                        }
                    }
                }
                return;
            }

            // ── Slash Commands ──
            if (!interaction.isChatInputCommand()) return;

            const commandMap = this.getCommandMap();
            const handler = commandMap[interaction.commandName];

            try {
                if (handler) {
                    await handler(interaction);
                } else {
                    await interaction.reply({ content: '⚠️ Comando desconhecido.', ephemeral: true });
                }
            } catch (err) {
                console.error(`❌ Erro no comando /${interaction.commandName}:`, err);
                const reply = { content: '❌ Ocorreu um erro interno. Tente novamente.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply);
                } else {
                    await interaction.reply(reply);
                }
            }
        });

        // ── Comandos Legados por Prefixo ──
        this.client.on('messageCreate', async (message) => {
            await handleBanLegado(message, this.legacyDb);
        });
    }

    start() {
        this.client.login(this.token).catch(err => {
            console.error("❌ Discord: Erro ao logar:", err);
        });
    }
}

module.exports = DiscordBot;
