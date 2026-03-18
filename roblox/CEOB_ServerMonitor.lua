--[[
    ═══════════════════════════════════════════════════════════════
    CEOB - Script de Monitoramento de Servidor para Roblox
    ═══════════════════════════════════════════════════════════════
    
    INSTRUÇÕES:
    1. Coloque este Script dentro de ServerScriptService no Roblox Studio
    2. Altere a API_URL para a URL da sua API (ex: https://bot-discord-production-38a7.up.railway.app)
    3. Altere a API_KEY para a mesma chave que está no seu .env
    4. Publique o jogo e teste!
    
    EVENTOS ENVIADOS:
    - POST /server-start  → Quando o servidor inicia
    - POST /player-join   → Quando um player entra
    - POST /player-leave  → Quando um player sai
    - POST /server-stop   → Quando o servidor encerra
--]]

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")

-- ══════════════════════════════════════════
-- CONFIGURAÇÃO - ALTERE ESTES VALORES
-- ══════════════════════════════════════════
local API_URL = "https://bot-discord-production-38a7.up.railway.app"  -- URL da API
local API_KEY = "BQmJKff9iGPc9NxAmhqmfk3rAfgs15TS"                    -- Mesma chave do .env
local SERVER_NAME = "darckzinho123"                     -- Nome do servidor (opcional)
-- ══════════════════════════════════════════

local jobId = game.JobId
local placeId = tostring(game.PlaceId)

-- Função auxiliar para enviar requisições HTTP
local function enviarParaAPI(endpoint, dados)
    local sucesso, erro = pcall(function()
        local url = API_URL .. endpoint
        local body = HttpService:JSONEncode(dados)
        
        HttpService:RequestAsync({
            Url = url,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["x-api-key"] = API_KEY,
            },
            Body = body,
        })
    end)
    
    if not sucesso then
        warn("[CEOB Monitor] Erro ao enviar para " .. endpoint .. ": " .. tostring(erro))
    end
end

-- ══════════════════════════════════════════
-- EVENTO: Servidor Iniciado
-- ══════════════════════════════════════════
enviarParaAPI("/server-start", {
    jobId = jobId,
    placeId = placeId,
    serverName = SERVER_NAME,
})
print("[CEOB Monitor] ✅ Servidor registrado na API | JobId: " .. jobId)

-- ══════════════════════════════════════════
-- EVENTO: Player Entrou
-- ══════════════════════════════════════════
Players.PlayerAdded:Connect(function(player)
    local playerId = tostring(player.UserId)
    local nickname = player.Name
    local displayName = player.DisplayName
    
    print("[CEOB Monitor] ➡️ Player entrou: " .. nickname .. " (ID: " .. playerId .. ")")
    
    enviarParaAPI("/player-join", {
        jobId = jobId,
        playerId = playerId,
        nickname = nickname,
        displayName = displayName,
    })
end)

-- ══════════════════════════════════════════
-- EVENTO: Player Saiu
-- ══════════════════════════════════════════
Players.PlayerRemoving:Connect(function(player)
    local playerId = tostring(player.UserId)
    local nickname = player.Name
    
    print("[CEOB Monitor] ⬅️ Player saiu: " .. nickname .. " (ID: " .. playerId .. ")")
    
    enviarParaAPI("/player-leave", {
        jobId = jobId,
        playerId = playerId,
        nickname = nickname,
    })
end)

-- ══════════════════════════════════════════
-- EVENTO: Servidor Encerrando
-- ══════════════════════════════════════════
game:BindToClose(function()
    print("[CEOB Monitor] 🔴 Servidor encerrando...")
    
    -- Envia notificação síncrona antes de fechar
    local sucesso, erro = pcall(function()
        HttpService:RequestAsync({
            Url = API_URL .. "/server-stop",
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["x-api-key"] = API_KEY,
            },
            Body = HttpService:JSONEncode({
                jobId = jobId,
            }),
        })
    end)
    
    if not sucesso then
        warn("[CEOB Monitor] Erro ao notificar encerramento: " .. tostring(erro))
    end
end)

print("[CEOB Monitor] ═══════════════════════════════════")
print("[CEOB Monitor]   Sistema de Monitoramento Ativo")
print("[CEOB Monitor]   JobId: " .. jobId)
print("[CEOB Monitor]   PlaceId: " .. placeId)
print("[CEOB Monitor] ═══════════════════════════════════")
