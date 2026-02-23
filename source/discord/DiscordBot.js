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

                        // Se APROVADO, ativa o militar
                        if (isAprovacao) {
                            await this.ceobDb.connection.query(
                                `UPDATE ceob.militares SET ativo = true, updated_at = NOW() WHERE id = $1`,
                                [reqAtualizado.militar_alvo_id]
                            );
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
                                { name: '💬 Justificativa', value: motivoDecisao, inline: false }
                            ]
                        };

                        await interaction.message.edit({ embeds: [embedAtualizado], components: [] });

                        const msgConfirmacao = isAprovacao
                            ? `✅ Requerimento **#${requerimentoId}** aprovado. O militar foi ativado no sistema.`
                            : `❌ Requerimento **#${requerimentoId}** indeferido. O solicitante será informado.`;

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
