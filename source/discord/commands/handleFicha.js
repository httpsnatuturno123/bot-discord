const buildFichaEmbed = require('../helpers/buildFichaEmbed');

/**
 * Handler do comando /ficha
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */
async function handleFicha(interaction, ceobDb) {
    try {
        await interaction.deferReply();

        const matricula = interaction.options.getString('matricula');
        const usuario = interaction.options.getUser('usuario');

        let militar = null;

        if (matricula) {
            militar = await ceobDb.militares.getByMatricula(matricula);
        } else if (usuario) {
            militar = await ceobDb.militares.getByDiscord(usuario.id);
        } else {
            return interaction.editReply('⚠️ Informe uma matrícula ou selecione um usuário.');
        }

        if (!militar) {
            return interaction.editReply('❌ Militar não encontrado.');
        }

        const ficha = await ceobDb.ficha.getCompleta(militar.id);
        const embed = buildFichaEmbed(ficha);
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Erro no comando ficha:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ Ocorreu um erro interno ao consultar a ficha.');
            } else {
                await interaction.reply({ content: '❌ Ocorreu um erro interno ao consultar a ficha.', ephemeral: true });
            }
        } catch (replyErr) {
            console.error('Falha ao enviar resposta de erro:', replyErr);
        }
    }
}

module.exports = handleFicha;
