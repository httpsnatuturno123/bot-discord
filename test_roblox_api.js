require('dotenv').config();

const apiKey = process.env.KEY_ROBLOX_API;
const groupId = '10488053'; // GRUPO_PRINCIPAL
const robloxUserId = '12345678'; // test user ID

async function testar() {
    try {
        const response = await fetch(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${robloxUserId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey
                },
                body: JSON.stringify({
                    role: `groups/${groupId}/roles/75656178` // Recruta
                })
            }
        );

        console.log("Status COM userID na URL:", response.status);
        const text = await response.text();
        console.log("Body:", text);

    } catch (err) {
        console.error("Erro:", err);
    }
}

testar();
