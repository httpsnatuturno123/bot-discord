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
 * Verifica se o usuário já é membro de um grupo.
 * @param {string} robloxUserId - ID do usuário no Roblox
 * @param {string} groupId - ID do grupo
 * @returns {Promise<{ isMembro: boolean, roleRank: number|null }>}
 */
async function verificarMembroGrupo(robloxUserId, groupId) {
    try {
        const response = await fetch(`https://groups.roblox.com/v2/users/${robloxUserId}/groups/roles`);

        if (!response.ok) {
            // Se não conseguir verificar, retornar como não membro (vai tentar adicionar normalmente)
            return { isMembro: false, roleRank: null };
        }

        const data = await response.json();
        const grupoEncontrado = (data.data || []).find(g => String(g.group.id) === String(groupId));

        if (grupoEncontrado) {
            return { isMembro: true, roleRank: grupoEncontrado.role.rank };
        }

        return { isMembro: false, roleRank: null };
    } catch {
        return { isMembro: false, roleRank: null };
    }
}

/**
 * Aceita um usuário no grupo principal CEOB e no grupo da OM correspondente.
 * Retorna resultados detalhados por grupo, incluindo mensagem de detalhe para feedback ao DGP.
 * @param {string} robloxUserId - ID do usuário no Roblox
 * @param {string} omSigla - Sigla da OM (para encontrar o grupo correspondente)
 * @returns {Promise<{ resultados: Array<{ grupo: string, sucesso: boolean, detalhe: string, erro?: string }> }>}
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
            // 0. Verificar se o usuário já é membro do grupo
            const { isMembro, roleRank } = await verificarMembroGrupo(robloxUserId, groupId);

            if (isMembro && roleRank > 0) {
                console.log(`ℹ️ Usuário ${robloxUserId} já é membro do grupo ${groupId} (rank ${roleRank}). Pulando.`);
                resultados.push({
                    grupo: groupId,
                    sucesso: true,
                    detalhe: `Já é membro do grupo (rank ${roleRank}). Nenhuma alteração feita.`
                });
                continue;
            }

            // 1. Buscar menor role viável
            const roleId = await buscarMenorRole(groupId);

            // 2. Tentar aceitar a requisição de entrada (se estiver pendente)
            let joinRequestAceito = false;
            try {
                const joinResp = await fetch(
                    `https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests/${robloxUserId}:accept`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey
                        }
                    }
                );

                if (joinResp.ok) {
                    joinRequestAceito = true;
                } else {
                    const joinErrText = await joinResp.text();
                    console.warn(`⚠️ Join-request não aceito para grupo ${groupId} (Status ${joinResp.status}): ${joinErrText}`);
                }
            } catch (joinErr) {
                console.warn(`⚠️ Erro ao tentar aceitar join-request no grupo ${groupId}:`, joinErr.message);
            }

            // 3. Tentar setar role no grupo via Open Cloud API
            const response = await fetch(
                `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${robloxUserId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey
                    },
                    body: JSON.stringify({
                        role: `groups/${groupId}/roles/${roleId}`
                    })
                }
            );

            if (response.ok) {
                const detalheMsg = joinRequestAceito
                    ? 'Join-request aceito e role atribuída com sucesso.'
                    : 'Role atribuída com sucesso.';
                resultados.push({ grupo: groupId, sucesso: true, detalhe: detalheMsg });
            } else {
                const errData = await response.text();
                let erroMsg = `Status ${response.status}`;

                // Tentar extrair mensagem de erro legível
                try {
                    const errJson = JSON.parse(errData);
                    if (errJson.message) {
                        erroMsg = errJson.message;
                    } else if (errJson.error) {
                        erroMsg = errJson.error;
                    }
                } catch {
                    if (errData && errData.length < 200) {
                        erroMsg = errData;
                    }
                }

                console.error(`❌ Roblox Groups API erro para grupo ${groupId}: ${erroMsg}`);
                resultados.push({
                    grupo: groupId,
                    sucesso: false,
                    detalhe: `Falha ao atribuir role (Status ${response.status}).`,
                    erro: erroMsg
                });
            }
        } catch (err) {
            console.error(`❌ Erro ao aceitar no grupo ${groupId}:`, err);
            resultados.push({
                grupo: groupId,
                sucesso: false,
                detalhe: `Erro inesperado: ${err.message}`,
                erro: err.message
            });
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
