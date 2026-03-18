const { handleCatalogoListar } = require('../commands/handleCatalogo');

/**
 * Verifica se o botão é de paginação do catálogo.
 */
function isCatalogoListarButton(customId) {
    return customId.startsWith('catalogo_listar_page_');
}

/**
 * Trata o clique nos botões de paginação do catálogo.
 */
async function handleCatalogoListarButton(interaction, ceobDb) {
    // customId: catalogo_listar_page_{mostrarArquivados}_{page}
    const parts = interaction.customId.split('_');
    const mostrarArquivados = parts[3] === 'true';
    const page = parseInt(parts[4]);

    return handleCatalogoListar(interaction, ceobDb, mostrarArquivados, page);
}

module.exports = { isCatalogoListarButton, handleCatalogoListarButton };
