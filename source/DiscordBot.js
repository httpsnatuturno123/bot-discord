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
                    case 'listar_recrutamento':
                        await this.handleListarRecrutamento(interaction);
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

    async handleListarRecrutamento(interaction) {
        await interaction.deferReply();

        // 1. Identifica e valida o executor do comando
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await this.ceobDb.getMilitarByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema e não tem permissão para listar recrutas.');
        }

        // 2. Verifica se o usuário tem permissão para usar (DGP ou Alto Comando)
        const pertenceDGP = await this.ceobDb.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isAltoComando = await this.ceobDb.isAltoComando(executorMilitar.id);

        if (!pertenceDGP && !isAltoComando) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas membros alocados na DGP ou no Alto Comando podem realizar listagens de recrutamento diretas.');
        }

        // 3. Captura os parâmetros
        const nomeGuerra = interaction.options.getString('nome_guerra');
        const robloxId = interaction.options.getString('roblox_id');
        const omSigla = interaction.options.getString('om').toUpperCase();
        const usuarioDiscord = interaction.options.getUser('usuario');

        if (isNaN(robloxId)) {
            return interaction.editReply('⚠️ O campo **Roblox ID** deve conter apenas números.');
        }

        // ==========================================
        // VALIDAÇÃO BLOQUEANTE: API DO ROBLOX
        // ==========================================
        let robloxUsername = null;
        try {
            const robloxResponse = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
            
            // Se o ID não existir (Erro 404)
            if (robloxResponse.status === 404) {
                return interaction.editReply(`❌ **Bloqueado:** Nenhuma conta do Roblox foi encontrada com o ID \`${robloxId}\`. Verifique se os números estão corretos.`);
            } 
            // Se a API do Roblox estiver fora do ar ou der Rate Limit
            else if (!robloxResponse.ok) {
                return interaction.editReply(`❌ **Erro na API do Roblox:** Não foi possível validar o ID no momento (Status: ${robloxResponse.status}). O registro foi bloqueado por segurança. Tente novamente mais tarde.`);
            }
            
            // Se deu tudo certo, extrai o nome
            const robloxData = await robloxResponse.json();
            robloxUsername = robloxData.name; 
            
        } catch (err) {
            console.error("Erro ao consultar API do Roblox:", err);
            // Se houver falha de rede (timeout, erro de DNS)
            return interaction.editReply(`❌ **Falha de Comunicação:** O bot não conseguiu se conectar aos servidores do Roblox para validar o ID. O registro foi cancelado.`);
        }
        // ==========================================

        // 4. Executa a inserção múltipla no banco (Transação)
        try {
            const resultado = await this.ceobDb.executarListagemRecrutamento({
                executadoPorId: executorMilitar.id,
                robloxId,
                robloxUsername, // <- Agora estamos passando o Username para salvar no banco
                nomeGuerra,
                omSigla,
                discordId: usuarioDiscord ? usuarioDiscord.id : null
            });

            // 5. Constrói o Boletim Eletrônico Visual (Agora mostrando também o username)
            const embed = {
                title: `📄 Boletim Interno — ${resultado.boletim.numero}`,
                description: resultado.boletim.conteudo,
                color: 0x219EBC,
                fields: [
                    { name: '🎖️ Nova Matrícula', value: `\`${resultado.militar.matricula}\``, inline: true },
                    { name: '🎮 Roblox', value: `${robloxUsername} (ID: ${robloxId})`, inline: true },
                    { name: '✍️ Listado por', value: `${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}`, inline: true }
                ],
                footer: { text: 'DGP — Departamento Geral do Pessoal' },
                timestamp: new Date()
            };

            // 6. Enviar a embed para o canal específico do .env
            const canalBoletimId = process.env.CANAL_BOLETIM_ID;
            
            if (!canalBoletimId) {
                // Fallback: se esquecer de configurar o .env, ele responde no próprio comando
                return interaction.editReply({ 
                    content: '✅ **Listagem concluída!** *(Aviso: CANAL_BOLETIM_ID não configurado no .env)*', 
                    embeds: [embed] 
                });
            }

            try {
                // Busca o canal e envia o boletim
                const canalDeBoletins = await interaction.client.channels.fetch(canalBoletimId);
                const mensagemEnviada = await canalDeBoletins.send({ embeds: [embed] });

                // (Opcional) O seu banco tem a coluna discord_message_id na tabela boletim_eletronico. 
                // Você pode salvar o ID da mensagem para consultas futuras!
                await this.ceobDb.query(
                    `UPDATE ceob.boletim_eletronico SET discord_message_id = $1 WHERE id = $2`, 
                    [mensagemEnviada.id, resultado.boletim.id]
                );

                // Dá o feedback para quem executou o comando
                await interaction.editReply(`✅ **Listagem concluída com sucesso!** O recruta foi registrado e o boletim foi publicado em ${canalDeBoletins}.`);

            } catch (err) {
                console.error('❌ Erro ao enviar mensagem para o canal de boletim:', err);
                await interaction.editReply(`✅ **Listagem salva no banco!** ⚠️ Porém, o bot não conseguiu enviar o boletim no canal. Verifique se o bot tem permissão de "Ver Canal" e "Enviar Mensagens" no canal configurado.`);
            }

        } catch (error) {
            console.error('Erro no recrutamento:', error);
            
            // Tratamento de erros específicos do banco
            if (error.message.includes('OM')) {
                return interaction.editReply(`❌ ${error.message}`);
            } else if (error.code === '23505') { // Código do Postgres para "Violação de campo único (UNIQUE)"
                return interaction.editReply('❌ **Erro**: Este Roblox ID ou Usuário do Discord já está cadastrado em outro militar no sistema.');
            }
            
            interaction.editReply('❌ Ocorreu um erro interno ao processar a listagem.');
        }
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
