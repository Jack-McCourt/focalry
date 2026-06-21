--[[
    WeddingAppAPI.lua — thin HTTP client over the Wedding App JSON API.

    Every function returns `status, data` where status is the HTTP status code
    (0 if the request never completed) and data is the decoded JSON body (or nil).
    Auth is a Sanctum bearer token obtained from API.login().
]]

local LrHttp = import 'LrHttp'
local LrFileUtils = import 'LrFileUtils'

local JSON = require 'JSON'

local API = {}

local function jsonHeaders(token)
    local h = {
        { field = 'Accept', value = 'application/json' },
        { field = 'Content-Type', value = 'application/json' },
    }
    if token then
        h[#h + 1] = { field = 'Authorization', value = 'Bearer ' .. token }
    end
    return h
end

local function decode(response)
    if not response or #response == 0 then return nil end
    local ok, data = pcall(JSON.decode, response)
    if ok then return data end
    return nil
end

-- method is one of POST / PUT / DELETE (LrHttp.post takes a method override).
local function send(method, url, token, bodyTable)
    local body = bodyTable and JSON.encode(bodyTable) or ''
    local response, headers = LrHttp.post(url, body, jsonHeaders(token), method, 60)
    local status = (headers and tonumber(headers.status)) or 0
    return status, decode(response)
end

local function get(url, token)
    local response, headers = LrHttp.get(url, jsonHeaders(token), 60)
    local status = (headers and tonumber(headers.status)) or 0
    return status, decode(response)
end

-- ── Auth + account ──────────────────────────────────────────────────────

function API.login(serverUrl, email, password)
    return send('POST', serverUrl .. '/api/lightroom/login', nil, {
        email = email,
        password = password,
        device_name = 'Lightroom Classic',
    })
end

function API.account(serverUrl, token)
    return get(serverUrl .. '/api/lightroom/account', token)
end

-- ── Galleries ─────────────────────────────────────────────────────────────

function API.listCollections(serverUrl, token)
    return get(serverUrl .. '/api/lightroom/collections', token)
end

function API.createCollection(serverUrl, token, title)
    return send('POST', serverUrl .. '/api/lightroom/collections', token, { title = title })
end

-- ── Photos ────────────────────────────────────────────────────────────────

function API.presign(serverUrl, token, collectionId, filename, contentType, fileSize)
    return send('POST', serverUrl .. '/api/uploads/presign', token, {
        collection_id = collectionId,
        filename = filename,
        content_type = contentType,
        file_size = fileSize,
    })
end

-- Upload the rendered file straight to Wasabi using the presigned URL.
-- `signedHeaders` is the header map returned by /uploads/presign and must be
-- replayed verbatim, otherwise the signature check fails.
function API.uploadToWasabi(signedUrl, signedHeaders, filePath)
    local data = LrFileUtils.readFile(filePath)
    local headers = {}
    if signedHeaders then
        for field, value in pairs(signedHeaders) do
            headers[#headers + 1] = { field = field, value = value }
        end
    end
    local _, respHeaders = LrHttp.post(signedUrl, data, headers, 'PUT', 300)
    return (respHeaders and tonumber(respHeaders.status)) or 0
end

function API.registerPhoto(serverUrl, token, collectionId, filename, wasabiKey, fileSize)
    return send('POST', serverUrl .. '/api/photos', token, {
        collection_id = collectionId,
        filename = filename,
        wasabi_key = wasabiKey,
        file_size = fileSize,
    })
end

function API.deletePhoto(serverUrl, token, photoId)
    local status = send('DELETE', serverUrl .. '/api/photos/' .. tostring(photoId), token, nil)
    return status
end

return API
