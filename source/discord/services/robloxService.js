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

    if (/^\d+$/.test(trimmed)) {
        return await validarPorId(trimmed);
    }

    return await resolverPorUsername(trimmed);
}

/**
 * Valida um userId numérico na API do Roblox.
 */
async function validarPorId(userId) {
    const response = await fetch(`https://users.roblox.com/v1/users/${userId}`);

    if (response.status === 404) {
        throw new RobloxError(
            `Nenhuma conta do Roblox encontrada com o ID \`${userId}\`.`
        );
    }
    if (!response.ok) {
        throw new RobloxError(
            `Erro na API do Roblox ao validar ID (Status: ${response.status}).`
        );
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
        throw new RobloxError(
            `Erro na API do Roblox ao buscar username (Status: ${response.status}).`
        );
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        throw new RobloxError(
            `Nenhuma conta do Roblox encontrada com o username \`${username}\`.`
        );
    }

    const user = data.data[0];
    return { userId: String(user.id), username: user.name };
}

/**
 * Busca o menor roleId viável (rank > 0) de um grupo.
 * @param {string} groupId
 * @returns {Promise<string>} roleId
 */
async function buscarMenorRole(groupId) {
    const response = await fetch(
        `https://groups.roblox.com/v1/groups/${groupId}/roles`
    );

    if (!response.ok) {
        throw new RobloxError(
            `Falha ao buscar roles do grupo ${groupId} (Status: ${response.status}).`
        );
    }

    const data = await response.json();
    const roles = data.roles || [];

    const rolesValidos = roles
        .filter(r => r.rank > 0)
        .sort((a, b) => a.rank - b.rank);

    if (rolesValidos.length === 0) {
        throw new RobloxError(
            `Nenhum role válido encontrado no grupo ${groupId}.`
        );
    }

    return String(rolesValidos[0].id);
}

/**
 * Converte userId para o formato de membershipId usado pela Open Cloud API.
 * O membershipId é o userId codificado em Base64.
 *
 * Exemplo: 268223118 → "MjY4MjIzMTE4"
 *
 * @param {string} userId
 * @returns {string} membershipId em Base64
 */
function userIdParaMembershipId(userId) {
    return Buffer.from(String(userId)).toString('base64');
}

/**
 * Verifica se o usuário já é membro de um grupo.
 * @param {string} robloxUserId
 * @param {string} groupId
 * @returns {Promise<{ isMembro: boolean, roleRank: number|null, roleName: string|null }>}
 */
async function verificarMembroGrupo(robloxUserId, groupId) {
    try {
        const response = await fetch(
            `https://groups.roblox.com/v2/users/${robloxUserId}/groups/roles`
        );

        if (!response.ok) {
            return { isMembro: false, roleRank: null, roleName: null };
        }

        const data = await response.json();
        const grupoEncontrado = (data.data || []).find(
            g => String(g.group.id) === String(groupId)
        );

        if (grupoEncontrado) {
            return {
                isMembro: true,
                roleRank: grupoEncontrado.role.rank,
                roleName: grupoEncontrado.role.name
            };
        }

        return { isMembro: false, roleRank: null, roleName: null };
    } catch {
        return { isMembro: false, roleRank: null, roleName: null };
    }
}

/**
 * Aguarda até que o usuário apareça como membro do grupo,
 * verificando periodicamente. Necessário porque após aceitar
 * um join-request há um delay de propagação.
 *
 * @param {string} robloxUserId
 * @param {string} groupId
 * @param {number} tentativas - Número máximo de tentativas
 * @param {number} intervaloMs - Intervalo entre tentativas em ms
 * @returns {Promise<boolean>} true se confirmou membership
 */
async function aguardarMembership(robloxUserId, groupId, tentativas = 5, intervaloMs = 2000) {
    for (let i = 1; i <= tentativas; i++) {
        console.log(
            `   ⏳ Verificando membership (tentativa ${i}/${tentativas})...`
        );

        await new Promise(resolve => setTimeout(resolve, intervaloMs));

        const { isMembro } = await verificarMembroGrupo(robloxUserId, groupId);
        if (isMembro) {
            console.log(`   ✅ Membership confirmada na tentativa ${i}`);
            return true;
        }
    }

    console.warn(`   ⚠️ Membership não confirmada após ${tentativas} tentativas`);
    return false;
}

/**
 * Faz PATCH na membership do usuário para atribuir uma role.
 * Usa o membershipId em Base64 (formato da Open Cloud API v2).
 *
 * @param {string} groupId
 * @param {string} robloxUserId
 * @param {string} roleId
 * @param {string} apiKey
 * @returns {Promise<{ ok: boolean, status: number, body: string }>}
 */
async function patchMembership(groupId, robloxUserId, roleId, apiKey) {
    const membershipId = userIdParaMembershipId(robloxUserId);
    const membershipPath = `groups/${groupId}/memberships/${membershipId}`;
    const url = `https://apis.roblox.com/cloud/v2/${membershipPath}`;
    const body = { role: `groups/${groupId}/roles/${roleId}` };

    console.log(`   🔧 PATCH membership`);
    console.log(`   URL: ${url}`);
    console.log(`   MembershipId: ${membershipId} (base64 de ${robloxUserId})`);
    console.log(`   Body: ${JSON.stringify(body)}`);

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(body)
    });

    const respText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Resposta: ${respText}`);

    return { ok: response.ok, status: response.status, body: respText };
}

/**
 * Aceita um usuário no grupo principal CEOB e no grupo da OM.
 *
 * Fluxo por grupo:
 * 1. Verificar se já é membro
 * 2. Buscar menor role viável
 * 3. Aceitar join-request (se pendente)
 * 4. Aguardar propagação da membership
 * 5. PATCH membership com membershipId em Base64
 *
 * @param {string} robloxUserId
 * @param {string} omSigla
 * @returns {Promise<{ resultados: Array }>}
 */
async function aceitarEmGrupos(robloxUserId, omSigla) {
    const apiKey = process.env.KEY_ROBLOX_API;

    if (!apiKey) {
        throw new RobloxError('KEY_ROBLOX_API não configurada no .env.');
    }

    const gruposParaAceitar = [GRUPO_PRINCIPAL];

    const grupoOm = OM_GRUPO_MAP[omSigla];
    if (grupoOm && !gruposParaAceitar.includes(grupoOm)) {
        gruposParaAceitar.push(grupoOm);
    }

    const resultados = [];

    for (const groupId of gruposParaAceitar) {
        try {
            // ─── 0. Verificar se já é membro ───
            const { isMembro, roleRank } = await verificarMembroGrupo(
                robloxUserId, groupId
            );

            if (isMembro && roleRank > 0) {
                console.log(
                    `ℹ️ Usuário ${robloxUserId} já é membro do grupo ${groupId} (rank ${roleRank}).`
                );
                resultados.push({
                    grupo: groupId,
                    sucesso: true,
                    detalhe: `Já é membro do grupo (rank ${roleRank}).`
                });
                continue;
            }

            // ─── 1. Buscar menor role viável ───
            const roleId = await buscarMenorRole(groupId);
            console.log(`   📌 Menor role do grupo ${groupId}: ${roleId}`);

            // ─── 2. Aceitar join-request ───
            let joinRequestAceito = false;
            try {
                console.log(
                    `   📨 Tentando aceitar join-request no grupo ${groupId}...`
                );
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
                    console.log(`   ✅ Join-request aceito!`);
                } else {
                    const joinErrText = await joinResp.text();
                    console.warn(
                        `   ⚠️ Join-request não aceito (Status ${joinResp.status}): ${joinErrText}`
                    );

                    // Se não há join-request E não é membro, não há o que fazer
                    if (!isMembro) {
                        resultados.push({
                            grupo: groupId,
                            sucesso: false,
                            detalhe: 'Usuário não enviou solicitação para este grupo.',
                            erro: `Join-request não encontrado (Status ${joinResp.status})`
                        });
                        continue;
                    }
                }
            } catch (joinErr) {
                console.warn(
                    `   ⚠️ Erro ao aceitar join-request:`, joinErr.message
                );

                if (!isMembro) {
                    resultados.push({
                        grupo: groupId,
                        sucesso: false,
                        detalhe: `Erro ao processar join-request: ${joinErr.message}`,
                        erro: joinErr.message
                    });
                    continue;
                }
            }

            // ─── 3. Aguardar propagação da membership ───
            if (joinRequestAceito) {
                const confirmado = await aguardarMembership(
                    robloxUserId, groupId, 5, 2000
                );

                if (!confirmado) {
                    resultados.push({
                        grupo: groupId,
                        sucesso: true,
                        detalhe: 'Join-request aceito, mas membership ainda não propagada. ' +
                            'O usuário entrou com a role padrão.'
                    });
                    continue;
                }
            }

            // ─── 4. PATCH membership (Base64 membershipId) ───
            const patchResult = await patchMembership(
                groupId, robloxUserId, roleId, apiKey
            );

            if (patchResult.ok) {
                const detalheMsg = joinRequestAceito
                    ? 'Join-request aceito e role atribuída com sucesso.'
                    : 'Role atribuída com sucesso.';
                resultados.push({
                    grupo: groupId,
                    sucesso: true,
                    detalhe: detalheMsg
                });
            } else {
                let erroMsg = `Status ${patchResult.status}`;

                try {
                    const errJson = JSON.parse(patchResult.body);
                    if (errJson.message) erroMsg = errJson.message;
                    else if (errJson.error) erroMsg = errJson.error;
                } catch {
                    if (patchResult.body && patchResult.body.length < 200) {
                        erroMsg = patchResult.body;
                    }
                }

                console.error(
                    `   ❌ PATCH falhou para grupo ${groupId}: ${erroMsg}`
                );

                if (joinRequestAceito) {
                    resultados.push({
                        grupo: groupId,
                        sucesso: true,
                        detalhe: `Join-request aceito (usuário entrou), mas falha ao alterar role: ${erroMsg}`
                    });
                } else {
                    resultados.push({
                        grupo: groupId,
                        sucesso: false,
                        detalhe: `Falha ao atribuir role.`,
                        erro: erroMsg
                    });
                }
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
    verificarMembroGrupo,
    userIdParaMembershipId,
    RobloxError,
    OM_GRUPO_MAP,
    GRUPO_PRINCIPAL
};