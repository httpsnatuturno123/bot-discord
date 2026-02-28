/**
 * Handler do comando /transferir_militar
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {import('../../database/CeobDatabase')} ceobDb
 */

async function handleTransferir(interaction, ceobDb) {
    try {
        await interaction.deferReply({ ephemeral: false });

        // 1. Valida o executor do comando
        const executorDiscordId = interaction.user.id;
        const executorMilitar = await ceobDb.militares.getByDiscord(executorDiscordId);

        if (!executorMilitar) {
            return interaction.editReply('❌ Você não possui cadastro no sistema.');
        }

        // 2. Verifica permissão: DGP ou Alto Comando
        const pertenceDGP = await ceobDb.permissoes.pertenceAoOrgao(executorMilitar.id, 'DGP');
        const isAltoComando = await ceobDb.permissoes.isAltoComando(executorMilitar.id);

        if (!pertenceDGP && !isAltoComando) {
            return interaction.editReply('❌ **Permissão Negada**: Apenas membros alocados na DGP ou no Alto Comando podem transferir militares diretamente.');
        }

        // 3. Obtém argumentos
        const matricula = interaction.options.getString('matricula');
        const omAlvoSigla = interaction.options.getString('om_alvo');
        const motivo = interaction.options.getString('motivo');

        // 4. Busca o militar alvo
        const militarAlvo = await ceobDb.militares.getByMatricula(matricula);
        if (!militarAlvo) {
            return interaction.editReply(`❌ Militar com matrícula **${matricula}** não encontrado.`);
        }

        // Não transfere se estiver inativo
        if (!militarAlvo.ativo || militarAlvo.situacao_funcional === 'EXCLUIDO') {
            return interaction.editReply('❌ O militar alvo não está ativo no sistema.');
        }

        // 5. Busca a OM de destino
        const omRows = await ceobDb.connection.query(`SELECT id, nome, sigla FROM ceob.organizacoes_militares WHERE sigla = $1`, [omAlvoSigla]);
        const omDestino = omRows.rows[0];

        if (!omDestino) {
            return interaction.editReply(`❌ Organização Militar com a sigla **${omAlvoSigla}** não encontrada.`);
        }

        if (militarAlvo.om_lotacao_id === omDestino.id) {
            return interaction.editReply(`❌ O militar já está lotado na OM **${omDestino.sigla}**.`);
        }

        // Busca a OM atual para log
        const omAtualRows = await ceobDb.connection.query(`SELECT sigla FROM ceob.organizacoes_militares WHERE id = $1`, [militarAlvo.om_lotacao_id]);
        const omAtualSigla = omAtualRows.rows[0] ? omAtualRows.rows[0].sigla : 'Sem OM';

        // 6. Atualiza o militar para a nova OM (Sem mexer nas funções dele que ficam a cargo do comandante/DGP dps tratar)
        await ceobDb.connection.query(
            `UPDATE ceob.militares SET om_lotacao_id = $1, updated_at = NOW() WHERE id = $2`,
            [omDestino.id, militarAlvo.id]
        );

        // 7. Registra na timeline
        const descricaoTimeline = `Transferência de OM: de ${omAtualSigla} para ${omDestino.sigla}. Motivo: ${motivo}`;
        await ceobDb.timeline.registrar({
            militarId: militarAlvo.id,
            tipoEvento: 'TRANSFERENCIA',
            descricao: descricaoTimeline,
            executadoPorId: executorMilitar.id,
            omContextoId: omDestino.id
        });

        // 8. Resposta no Discord
        const embed = {
            title: `🔄 Transferência Realizada Diretamente`,
            description: `A transferência do militar foi efetuada com sucesso.`,
            color: 0x3498db, // Azul
            fields: [
                { name: '🎖️ Militar', value: `${militarAlvo.patente_abrev} ${militarAlvo.nome_guerra} (${militarAlvo.matricula})`, inline: false },
                { name: '🏢 Transferido para', value: `**${omDestino.sigla}** - ${omDestino.nome}`, inline: true },
                { name: '🏢 OM Anterior', value: `${omAtualSigla}`, inline: true },
                { name: '📝 Motivo', value: motivo, inline: false },
                { name: '⚙️ Executado por', value: `${executorMilitar.patente_abrev} ${executorMilitar.nome_guerra}`, inline: false }
            ],
            footer: { text: 'DGP — Departamento Geral do Pessoal' },
            timestamp: new Date()
        };

        const canalBoletimId = process.env.CANAL_BOLETIM_ID;
        if (canalBoletimId) {
            try {
                const canalBoletim = await interaction.client.channels.fetch(canalBoletimId);
                await canalBoletim.send({ embeds: [embed] });
            } catch (err) {
                console.error("Erro ao enviar no canal de boletim: ", err);
            }
        }

        await interaction.editReply({ content: '✅ A transferência foi efetuada com sucesso e documentada no canal de boletim.', embeds: [embed] });

    } catch (error) {
        console.error('Erro na transferência:', error);
        await interaction.editReply('❌ Ocorreu um erro interno ao processar a transferência.');
    }
}

module.exports = handleTransferir;
