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
 * Busca todos os roles de um grupo no Roblox.
 * @returns {Promise<Array<{ id: number, name: string, rank: number }>>}
 */
async function buscarRolesDoGrupo(groupId) {
    const response = await fetch(
        `https://groups.roblox.com/v1/groups/${groupId}/roles`
    );

    if (!response.ok) {
        throw new RobloxError(
            `Falha ao buscar roles do grupo ${groupId} (Status: ${response.status}).`
        );
    }

    const data = await response.json();
    return data.roles || [];
}

/**
 * Busca o menor roleId viável (rank > 0) de um grupo.
 */
async function buscarMenorRole(groupId) {
    const roles = await buscarRolesDoGrupo(groupId);

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
 * Busca o roleId correspondente a um rank numérico no grupo.
 * @param {string} groupId - ID do grupo Roblox
 * @param {number} rankNumber - Número do rank (1-255)
 * @returns {Promise<string>} O roleId interno do Roblox
 */
async function buscarRolePorRank(groupId, rankNumber) {
    const roles = await buscarRolesDoGrupo(groupId);
    const role = roles.find(r => r.rank === rankNumber);

    if (!role) {
        const rolesDisponiveis = roles
            .filter(r => r.rank > 0)
            .sort((a, b) => a.rank - b.rank)
            .map(r => `  Rank ${r.rank}: ${r.name} (ID: ${r.id})`)
            .join('\n');
        throw new RobloxError(
            `Nenhum role com rank ${rankNumber} encontrado no grupo ${groupId}.\n` +
            `Roles disponíveis:\n${rolesDisponiveis}`
        );
    }

    return String(role.id);
}

/**
 * Converte userId para membershipId (Base64).
 * Formato descoberto: groups/{id}/memberships/{base64(userId)}
 *
 * Exemplo: 268223118 → "MjY4MjIzMTE4"
 */
function userIdParaMembershipId(userId) {
    return Buffer.from(String(userId)).toString('base64');
}

/**
 * Verifica se o usuário já é membro de um grupo.
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
 * Aguarda até que o usuário apareça como membro do grupo.
 * Necessário porque após aceitar join-request há delay de propagação.
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

    console.warn(
        `   ⚠️ Membership não confirmada após ${tentativas} tentativas`
    );
    return false;
}

/**
 * Aceita o join-request de um usuário em um grupo.
 *
 * IMPORTANTE: A API exige body: {} (objeto vazio).
 * Sem body, retorna 400.
 *
 * @returns {Promise<{ aceito: boolean, status: number, erro?: string }>}
 */
async function aceitarJoinRequest(groupId, robloxUserId, apiKey) {
    const url =
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/join-requests/${robloxUserId}:accept`;

    console.log(`   📨 Aceitando join-request...`);
    console.log(`   URL: ${url}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify({})  // ← OBRIGATÓRIO! Sem isso retorna 400
    });

    const respText = await response.text();
    console.log(`   Status: ${response.status}`);
    console.log(`   Resposta: ${respText}`);

    if (response.ok) {
        return { aceito: true, status: response.status };
    }

    return { aceito: false, status: response.status, erro: respText };
}

/**
 * Faz PATCH na membership para atribuir role.
 * Usa membershipId em Base64.
 *
 * @returns {Promise<{ ok: boolean, status: number, body: string }>}
 */
async function patchMembership(groupId, robloxUserId, roleId, apiKey) {
    const membershipId = userIdParaMembershipId(robloxUserId);
    const url =
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}`;
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
 * 3. Aceitar join-request (com body: {})
 * 4. Aguardar propagação da membership (retry)
 * 5. PATCH membership com membershipId Base64
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
            console.log(`\n── Processando grupo ${groupId} ──`);

            // ─── 0. Verificar se já é membro ───
            const { isMembro, roleRank } = await verificarMembroGrupo(
                robloxUserId, groupId
            );

            if (isMembro && roleRank > 0) {
                console.log(
                    `   ℹ️ Já é membro (rank ${roleRank}). Pulando.`
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
            console.log(`   📌 Menor role: ${roleId}`);

            // ─── 2. Aceitar join-request ───
            let joinRequestAceito = false;

            if (!isMembro) {
                const joinResult = await aceitarJoinRequest(
                    groupId, robloxUserId, apiKey
                );

                if (joinResult.aceito) {
                    joinRequestAceito = true;
                    console.log(`   ✅ Join-request aceito!`);
                } else {
                    console.warn(
                        `   ⚠️ Join-request falhou (Status ${joinResult.status})`
                    );
                    resultados.push({
                        grupo: groupId,
                        sucesso: false,
                        detalhe: 'Usuário não enviou solicitação para este grupo.',
                        erro: `Status ${joinResult.status}: ${joinResult.erro || 'Sem detalhes'}`
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
                        detalhe:
                            'Join-request aceito, mas membership ainda não propagada. ' +
                            'O usuário entrou com a role padrão.'
                    });
                    continue;
                }
            }

            // ─── 4. PATCH membership ───
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
                    `   ❌ PATCH falhou: ${erroMsg}`
                );

                if (joinRequestAceito) {
                    resultados.push({
                        grupo: groupId,
                        sucesso: true,
                        detalhe:
                            `Join-request aceito (usuário entrou), ` +
                            `mas falha ao alterar role: ${erroMsg}`
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
            console.error(`❌ Erro no grupo ${groupId}:`, err);
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

/**
 * Promove um membro no grupo principal do Roblox.
 * Busca automaticamente o roleId correto a partir do rank numérico,
 * seguindo o mesmo padrão de aceitarEmGrupos/buscarMenorRole.
 *
 * @param {string} robloxUserId - ID do usuário no Roblox
 * @param {number} rankNumber - Número do rank no grupo (1-255)
 */
async function promoverMembro(robloxUserId, rankNumber) {
    const apiKey = process.env.KEY_ROBLOX_API;

    if (!apiKey) {
        throw new RobloxError('KEY_ROBLOX_API não configurada no .env.');
    }

    // Resolve o rank numérico para o roleId interno do Roblox
    const roleId = await buscarRolePorRank(GRUPO_PRINCIPAL, rankNumber);
    console.log(`   📌 Rank ${rankNumber} → roleId ${roleId}`);

    const patchResult = await patchMembership(
        GRUPO_PRINCIPAL, robloxUserId, roleId, apiKey
    );

    if (!patchResult.ok) {
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
        throw new RobloxError(`Falha ao atualizar rank no Roblox: ${erroMsg}`);
    }

    return true;
}

/**
 * Remove um membro do(s) grupo(s) do Roblox (Principal + OM).
 * Como a Cloud API v2 não possui DELETE de membership,
 * a remoção é feita via PATCH para a role de rank 0 (Guest).
 *
 * @param {string} robloxUserId - ID do usuário no Roblox
 * @param {string} omSigla - Sigla da OM do militar
 * @returns {Promise<{ resultados: Array }>}
 */
async function removerDeGrupos(robloxUserId, omSigla) {
    const apiKey = process.env.KEY_ROBLOX_API;

    if (!apiKey) {
        throw new RobloxError('KEY_ROBLOX_API não configurada no .env.');
    }

    const gruposParaRemover = [GRUPO_PRINCIPAL];

    const grupoOm = OM_GRUPO_MAP[omSigla];
    if (grupoOm && !gruposParaRemover.includes(grupoOm)) {
        gruposParaRemover.push(grupoOm);
    }

    const resultados = [];

    for (const groupId of gruposParaRemover) {
        try {
            console.log(`\n── Removendo do grupo ${groupId} ──`);

            // 1. Verificar se é membro
            const { isMembro, roleRank } = await verificarMembroGrupo(
                robloxUserId, groupId
            );

            if (!isMembro) {
                console.log(`   ℹ️ Não é membro do grupo. Pulando.`);
                resultados.push({
                    grupo: groupId,
                    sucesso: true,
                    detalhe: 'Não é membro do grupo.'
                });
                continue;
            }

            if (roleRank === 0) {
                console.log(`   ℹ️ Já é Guest (rank 0). Pulando.`);
                resultados.push({
                    grupo: groupId,
                    sucesso: true,
                    detalhe: 'Já é Guest no grupo.'
                });
                continue;
            }

            // 2. Buscar role de rank 0 (Guest)
            const roles = await buscarRolesDoGrupo(groupId);
            const guestRole = roles.find(r => r.rank === 0);

            if (!guestRole) {
                console.warn(`   ⚠️ Role de Guest (rank 0) não encontrada.`);
                resultados.push({
                    grupo: groupId,
                    sucesso: false,
                    detalhe: 'Role de Guest (rank 0) não encontrada no grupo.'
                });
                continue;
            }

            // 3. PATCH membership para Guest
            const patchResult = await patchMembership(
                groupId, robloxUserId, String(guestRole.id), apiKey
            );

            if (patchResult.ok) {
                console.log(`   ✅ Removido (rebaixado para Guest).`);
                resultados.push({
                    grupo: groupId,
                    sucesso: true,
                    detalhe: 'Membro removido (rebaixado para Guest).'
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

                console.error(`   ❌ Falha ao remover: ${erroMsg}`);
                resultados.push({
                    grupo: groupId,
                    sucesso: false,
                    detalhe: `Falha ao remover do grupo: ${erroMsg}`
                });
            }
        } catch (err) {
            console.error(`❌ Erro no grupo ${groupId}:`, err);
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

module.exports = {
    resolverUsuario,
    aceitarEmGrupos,
    buscarMenorRole,
    verificarMembroGrupo,
    userIdParaMembershipId,
    RobloxError,
    OM_GRUPO_MAP,
    GRUPO_PRINCIPAL,
    promoverMembro,
    removerDeGrupos
};