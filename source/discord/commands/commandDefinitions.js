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

        new SlashCommandBuilder()
            .setName('requerer_recrutamento')
            .setDescription('Solicitação de ingresso de um recruta, para verificação do DGP (Patente >= Cabo)')
            .addStringOption(opt =>
                opt.setName('nome_guerra')
                    .setDescription('Nome de Guerra do recruta')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('roblox_id')
                    .setDescription('ID da conta do Roblox (Apenas números)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('om')
                    .setDescription('Sigla da OM de destino (ex: 1º BI, PE)')
                    .setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('motivo')
                    .setDescription('Motivo/Informação adicional da solicitação (Opcional)')
                    .setRequired(false)
            )
            .addUserOption(opt =>
                opt.setName('usuario')
                    .setDescription('Usuário do Discord (Opcional, porém recomendado)')
                    .setRequired(false)
            ),
    ].map(cmd => cmd.toJSON());
}

module.exports = getSlashCommands;
