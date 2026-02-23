// source/discord/services/robloxService.js

const GRUPO_PRINCIPAL = '10488053'; // Militares em Geral - CEOB

const OM_GRUPO_MAP = {
    'PE': '5564740',
    '5º BIL': '15184333',
    '9º BEC': '11093503',
    'COTER': '6833008',
};

/**
 * Resolve um input (username ou userId numérico) para { userId, username }.
 * @param {string} input - Username ou ID numérico do Roblox
 * @returns {Promise<{ userId: string, username: string }>}
 */
async function resolverUsuario(input) {
    const trimmed = input.trim();

    // Se for numérico, tratar como userId direto
    if (/^\d+$/.test(trimmed)) {
        return await validarPorId(trimmed);
    }

    // Caso contrário, resolver username → userId
    return await resolverPorUsername(trimmed);
}

/**
 * Valida um userId numérico na API do Roblox.
 */
async function validarPorId(userId) {
    const response = await fetch(`https://users.roblox.com/v1/users/${userId}`);

    if (response.status === 404) {
        throw new RobloxError(`Nenhuma conta do Roblox encontrada com o ID \`${userId}\`.`);
    }
    if (!response.ok) {
        throw new RobloxError(`Erro na API do Roblox ao validar ID (Status: ${response.status}). Tente novamente mais tarde.`);
    }

    const data = await response.json();
    return { userId: String(data.id), username: data.name };
}

/**
 * Resolve um username para userId via API do Roblox.
 */
async function resolverPorUsername(username) {
    const response = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: false
        })
    });

    if (!response.ok) {
        throw new RobloxError(`Erro na API do Roblox ao buscar username (Status: ${response.status}). Tente novamente mais tarde.`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        throw new RobloxError(`Nenhuma conta do Roblox encontrada com o username \`${username}\`.`);
    }

    const user = data.data[0];
    return { userId: String(user.id), username: user.name };
}

/**
 * Busca o menor roleId viável (rank > 0, ou seja, não Guest) de um grupo.
 * @param {string} groupId
 * @returns {Promise<string>} roleId
 */
async function buscarMenorRole(groupId) {
    const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}/roles`);

    if (!response.ok) {
        throw new RobloxError(`Falha ao buscar roles do grupo ${groupId} (Status: ${response.status}).`);
    }

    const data = await response.json();
    const roles = data.roles || [];

    // Filtrar Guest (rank 0) e ordenar por rank crescente
    const rolesValidos = roles
        .filter(r => r.rank > 0)
        .sort((a, b) => a.rank - b.rank);

    if (rolesValidos.length === 0) {
        throw new RobloxError(`Nenhum role válido encontrado no grupo ${groupId}.`);
    }

    return String(rolesValidos[0].id);
}

/**
 * Aceita um usuário no grupo principal CEOB e no grupo da OM correspondente.
 * @param {string} robloxUserId - ID do usuário no Roblox
 * @param {string} omSigla - Sigla da OM (para encontrar o grupo correspondente)
 * @returns {Promise<{ resultados: Array<{ grupo: string, sucesso: boolean, erro?: string }> }>}
 */
async function aceitarEmGrupos(robloxUserId, omSigla) {
    const apiKey = process.env.KEY_ROBLOX_API;

    if (!apiKey) {
        throw new RobloxError('KEY_ROBLOX_API não configurada no .env.');
    }

    const gruposParaAceitar = [GRUPO_PRINCIPAL];

    // Adicionar grupo da OM se existir no mapa
    const grupoOm = OM_GRUPO_MAP[omSigla];
    if (grupoOm && !gruposParaAceitar.includes(grupoOm)) {
        gruposParaAceitar.push(grupoOm);
    }

    const resultados = [];

    for (const groupId of gruposParaAceitar) {
        try {
            // 1. Buscar menor role viável
            const roleId = await buscarMenorRole(groupId);

            // 2. Tentar aceitar/setar role no grupo via Open Cloud API
            const response = await fetch(
                `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    },
                    body: JSON.stringify({
                        user: `users/${robloxUserId}`,
                        role: `groups/${groupId}/roles/${roleId}`
                    })
                }
            );

            if (response.ok) {
                resultados.push({ grupo: groupId, sucesso: true });
            } else {
                const errData = await response.text();
                console.error(`❌ Roblox Groups API erro para grupo ${groupId}:`, errData);
                resultados.push({ grupo: groupId, sucesso: false, erro: `Status ${response.status}` });
            }
        } catch (err) {
            console.error(`❌ Erro ao aceitar no grupo ${groupId}:`, err);
            resultados.push({ grupo: groupId, sucesso: false, erro: err.message });
        }
    }

    return { resultados };
}

/**
 * Erro customizado para operações do Roblox.
 */
class RobloxError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RobloxError';
    }
}

module.exports = {
    resolverUsuario,
    aceitarEmGrupos,
    buscarMenorRole,
    RobloxError,
    OM_GRUPO_MAP,
    GRUPO_PRINCIPAL
};
