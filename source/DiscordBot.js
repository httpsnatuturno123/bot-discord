const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

class DiscordBot {
    constructor(token, legacyDb, ceobDb) {
        this.token = token;
        this.legacyDb = legacyDb;  // MySQL legado (pode ser null)
        this.ceobDb = ceobDb;      // PostgreSQL CEOB

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
    // Definição dos Slash Commands
    // ────────────────────────────────────────────────────
    getSlashCommands() {
        return [
            new SlashCommandBuilder()
                .setName('ficha')
                .setDescription('Consulta a ficha de um militar')
                .addStringOption(opt =>
                    opt.setName('matricula')
                        .setDescription('Matrícula do militar (ex: 2026-0001)')
                        .setRequired(false)
                )
                .addUserOption(opt =>
                    opt.setName('usuario')
                        .setDescription('Usuário do Discord do militar')
                        .setRequired(false)
                ),

            new SlashCommandBuilder()
                .setName('patentes')
                .setDescription('Lista todas as patentes da hierarquia'),

            new SlashCommandBuilder()
                .setName('oms')
                .setDescription('Lista todas as Organizações Militares ativas'),

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
        ].map(cmd => cmd.toJSON());
    }

    // ────────────────────────────────────────────────────
    // Registro dos Slash Commands
    // ────────────────────────────────────────────────────
    async registerCommands() {
        const rest = new REST({ version: '10' }).setToken(this.token);

        try {
            const commands = this.getSlashCommands();
            console.log(`🔄 Discord: Registrando ${commands.length} slash commands...`);

            if (process.env.DISCORD_GUILD_ID) {
                // Registro por servidor (instantâneo, bom para dev)
                await rest.put(
                    Routes.applicationGuildCommands(this.client.user.id, process.env.DISCORD_GUILD_ID),
                    { body: commands }
                );
                console.log(`✅ Discord: Slash commands registrados no servidor ${process.env.DISCORD_GUILD_ID}`);
            } else {
                // Registro global (pode demorar até 1h para propagar)
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
    // Event Handlers
    // ────────────────────────────────────────────────────
    setupEvents() {
        this.client.once('ready', async () => {
            console.log(`✅ Discord: Bot logado como ${this.client.user.tag}`);
            await this.registerCommands();
        });

        // ── Slash Commands ──
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            try {
                switch (interaction.commandName) {
                    case 'ficha':
                        await this.handleFicha(interaction);
                        break;
                    case 'patentes':
                        await this.handlePatentes(interaction);
                        break;
                    case 'oms':
                        await this.handleOMs(interaction);
                        break;
                    case 'efetivo':
                        await this.handleEfetivo(interaction);
                        break;
                    case 'minhaperfil':
                        await this.handleMinhaPerfil(interaction);
                        break;
                    default:
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

        // ── Comandos Legados por Prefixo (mantidos) ──
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            if (!this.legacyDb) return; // Sem banco legado, ignora prefixos
            if (!message.content.startsWith('!ban')) return;

            const args = message.content.trim().split(/\s+/);
            const userId = args[1];
            const reason = args.slice(2).join(" ") || "Sem motivo especificado";

            if (!userId || isNaN(userId)) {
                return message.reply("⚠️ Informe um UserId válido (apenas números).");
            }

            try {
                await this.legacyDb.addBan(userId, reason);
                console.log(`📌 Discord: Ban salvo no banco: ${userId}`);
                message.reply(`🚫 UserId ${userId} salvo no banco. O Roblox fará a leitura em breve.`);
            } catch (err) {
                console.error("❌ Erro ao salvar ban via Discord:", err);
                message.reply("❌ Ocorreu um erro interno ao tentar registrar o banimento.");
            }
        });
    }

    // ────────────────────────────────────────────────────
    // Handlers dos Slash Commands
    // ────────────────────────────────────────────────────

    async handleFicha(interaction) {
        await interaction.deferReply();

        const matricula = interaction.options.getString('matricula');
        const usuario = interaction.options.getUser('usuario');

        let militar = null;

        if (matricula) {
            militar = await this.ceobDb.getMilitarByMatricula(matricula);
        } else if (usuario) {
            militar = await this.ceobDb.getMilitarByDiscord(usuario.id);
        } else {
            return interaction.editReply('⚠️ Informe uma matrícula ou selecione um usuário.');
        }

        if (!militar) {
            return interaction.editReply('❌ Militar não encontrado.');
        }

        const ficha = await this.ceobDb.getFichaCompleta(militar.id);
        const embed = this.buildFichaEmbed(ficha);
        await interaction.editReply({ embeds: [embed] });
    }

    async handlePatentes(interaction) {
        const patentes = await this.ceobDb.getPatentes();

        let desc = '';
        let currentCirculo = '';

        for (const p of patentes) {
            if (p.circulo !== currentCirculo) {
                currentCirculo = p.circulo;
                const label = currentCirculo.replace(/_/g, ' ');
                desc += `\n**── ${label} ──**\n`;
            }
            const especial = p.is_praca_especial ? ' ⭐' : '';
            desc += `\`${String(p.ordem_precedencia).padStart(2, ' ')}\` ${p.abreviacao} — ${p.nome}${especial}\n`;
        }

        await interaction.reply({
            embeds: [{
                title: '🎖️ Hierarquia de Patentes do CEOB',
                description: desc.trim(),
                color: 0x1B4332,
                footer: { text: '⭐ = Praça Especial' }
            }]
        });
    }

    async handleOMs(interaction) {
        const oms = await this.ceobDb.getOMs();

        let desc = '';
        for (const om of oms) {
            const parent = om.parent_id
                ? oms.find(o => o.id === om.parent_id)?.sigla || '?'
                : '—';
            desc += `**${om.sigla}** — ${om.nome} (↑ ${parent})\n`;
        }

        await interaction.reply({
            embeds: [{
                title: '🏛️ Organizações Militares do CEOB',
                description: desc.trim(),
                color: 0x2D6A4F
            }]
        });
    }

    async handleEfetivo(interaction) {
        const sigla = interaction.options.getString('sigla').toUpperCase();
        const om = await this.ceobDb.getOMBySigla(sigla);

        if (!om) {
            return interaction.reply({ content: `❌ OM com sigla "${sigla}" não encontrada.`, ephemeral: true });
        }

        const efetivo = await this.ceobDb.getEfetivoOM(om.id);
        const max = om.efetivo_maximo ? ` / ${om.efetivo_maximo}` : '';

        await interaction.reply({
            embeds: [{
                title: `📊 Efetivo — ${om.sigla}`,
                description: `**${om.nome}**\n\nMilitares ativos: **${efetivo}${max}**`,
                color: 0x40916C
            }]
        });
    }

    async handleMinhaPerfil(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const militar = await this.ceobDb.getMilitarByDiscord(interaction.user.id);

        if (!militar) {
            return interaction.editReply('❌ Você não possui cadastro no CEOB. Solicite seu registro a um superior.');
        }

        const ficha = await this.ceobDb.getFichaCompleta(militar.id);
        const embed = this.buildFichaEmbed(ficha);
        await interaction.editReply({ embeds: [embed] });
    }

    // ────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────

    buildFichaEmbed(ficha) {
        const m = ficha.militar;
        if (!m) {
            return { title: '❌ Militar não encontrado', color: 0xFF0000 };
        }

        const funcoesStr = ficha.funcoes.length > 0
            ? ficha.funcoes.map(f => `${f.funcao_nome} (${f.om_sigla})`).join('\n')
            : 'Nenhuma';

        const timelineStr = ficha.timeline.slice(0, 5).map(t => {
            const data = new Date(t.created_at).toLocaleDateString('pt-BR');
            return `\`${data}\` ${t.tipo_evento} — ${t.descricao}`;
        }).join('\n') || 'Sem eventos';

        return {
            title: `📋 Ficha Militar — ${m.patente_abrev} ${m.nome_guerra}`,
            color: 0x1B4332,
            fields: [
                { name: 'Matrícula', value: m.matricula, inline: true },
                { name: 'Patente', value: `${m.patente_nome} (${m.patente_abrev})`, inline: true },
                { name: 'Situação', value: m.situacao_funcional, inline: true },
                { name: 'OM de Lotação', value: `${m.om_nome} (${m.om_sigla})`, inline: true },
                { name: 'Ingresso', value: new Date(m.data_ingresso).toLocaleDateString('pt-BR'), inline: true },
                { name: 'Roblox ID', value: String(m.roblox_user_id), inline: true },
                { name: '── Funções Ativas ──', value: funcoesStr, inline: false },
                { name: '── Últimos Eventos ──', value: timelineStr, inline: false },
            ],
            footer: { text: `ID interno: ${m.id} | Círculo: ${m.circulo}` }
        };
    }

    start() {
        this.client.login(this.token).catch(err => {
            console.error("❌ Discord: Erro ao logar:", err);
        });
    }
}

module.exports = DiscordBot;
