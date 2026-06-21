--[[
    JSON.lua — minimal, dependency-free JSON encode/decode.

    The Lightroom SDK does not bundle a JSON library, so the plugin ships its
    own. This handles the subset the Wedding App API uses: objects, arrays,
    strings (with standard + \uXXXX escapes), numbers, booleans and null.
]]

local JSON = {}

-- ── Encode ──────────────────────────────────────────────────────────────

local ESCAPES = {
    ['"'] = '\\"', ['\\'] = '\\\\', ['\b'] = '\\b',
    ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t',
}

local function encodeString(s)
    return '"' .. s:gsub('[%z\1-\31\\"]', function(c)
        return ESCAPES[c] or string.format('\\u%04x', string.byte(c))
    end) .. '"'
end

local function isArray(t)
    local n = 0
    for k in pairs(t) do
        if type(k) ~= 'number' then return false end
        n = n + 1
    end
    return n == #t
end

local encodeValue

encodeValue = function(v)
    local t = type(v)
    if t == 'nil' then
        return 'null'
    elseif t == 'boolean' then
        return v and 'true' or 'false'
    elseif t == 'number' then
        return tostring(v)
    elseif t == 'string' then
        return encodeString(v)
    elseif t == 'table' then
        if next(v) == nil then return '{}' end
        if isArray(v) then
            local parts = {}
            for _, item in ipairs(v) do parts[#parts + 1] = encodeValue(item) end
            return '[' .. table.concat(parts, ',') .. ']'
        end
        local parts = {}
        for k, val in pairs(v) do
            parts[#parts + 1] = encodeString(tostring(k)) .. ':' .. encodeValue(val)
        end
        return '{' .. table.concat(parts, ',') .. '}'
    end
    error('JSON.encode: cannot encode value of type ' .. t)
end

function JSON.encode(v)
    return encodeValue(v)
end

-- ── Decode ──────────────────────────────────────────────────────────────

local parseValue

local function skipWhitespace(s, i)
    local _, j = s:find('^[ \t\r\n]*', i)
    return (j or (i - 1)) + 1
end

local UNESCAPES = {
    ['"'] = '"', ['\\'] = '\\', ['/'] = '/',
    b = '\b', f = '\f', n = '\n', r = '\r', t = '\t',
}

local function utf8FromCodepoint(code)
    if code < 0x80 then
        return string.char(code)
    elseif code < 0x800 then
        return string.char(0xC0 + math.floor(code / 0x40), 0x80 + code % 0x40)
    end
    return string.char(
        0xE0 + math.floor(code / 0x1000),
        0x80 + math.floor(code / 0x40) % 0x40,
        0x80 + code % 0x40
    )
end

local function parseString(s, i)
    i = i + 1 -- skip opening quote
    local buf = {}
    while i <= #s do
        local c = s:sub(i, i)
        if c == '"' then
            return table.concat(buf), i + 1
        elseif c == '\\' then
            local n = s:sub(i + 1, i + 1)
            if n == 'u' then
                buf[#buf + 1] = utf8FromCodepoint(tonumber(s:sub(i + 2, i + 5), 16))
                i = i + 6
            else
                buf[#buf + 1] = UNESCAPES[n] or n
                i = i + 2
            end
        else
            buf[#buf + 1] = c
            i = i + 1
        end
    end
    error('JSON.decode: unterminated string')
end

local function parseNumber(s, i)
    local num = s:match('^%-?%d+%.?%d*[eE]?[%+%-]?%d*', i)
    return tonumber(num), i + #num
end

local function parseArray(s, i)
    i = skipWhitespace(s, i + 1)
    local arr = {}
    if s:sub(i, i) == ']' then return arr, i + 1 end
    while true do
        local v
        v, i = parseValue(s, i)
        arr[#arr + 1] = v
        i = skipWhitespace(s, i)
        local c = s:sub(i, i)
        if c == ',' then
            i = skipWhitespace(s, i + 1)
        elseif c == ']' then
            return arr, i + 1
        else
            error('JSON.decode: expected , or ] at ' .. i)
        end
    end
end

local function parseObject(s, i)
    i = skipWhitespace(s, i + 1)
    local obj = {}
    if s:sub(i, i) == '}' then return obj, i + 1 end
    while true do
        i = skipWhitespace(s, i)
        if s:sub(i, i) ~= '"' then error('JSON.decode: expected string key at ' .. i) end
        local key
        key, i = parseString(s, i)
        i = skipWhitespace(s, i)
        if s:sub(i, i) ~= ':' then error('JSON.decode: expected : at ' .. i) end
        local v
        v, i = parseValue(s, skipWhitespace(s, i + 1))
        obj[key] = v
        i = skipWhitespace(s, i)
        local c = s:sub(i, i)
        if c == ',' then
            i = i + 1
        elseif c == '}' then
            return obj, i + 1
        else
            error('JSON.decode: expected , or } at ' .. i)
        end
    end
end

parseValue = function(s, i)
    i = skipWhitespace(s, i)
    local c = s:sub(i, i)
    if c == '{' then return parseObject(s, i) end
    if c == '[' then return parseArray(s, i) end
    if c == '"' then return parseString(s, i) end
    if c == '-' or c:match('%d') then return parseNumber(s, i) end
    if s:sub(i, i + 3) == 'true' then return true, i + 4 end
    if s:sub(i, i + 4) == 'false' then return false, i + 5 end
    if s:sub(i, i + 3) == 'null' then return nil, i + 4 end
    error('JSON.decode: unexpected character "' .. c .. '" at ' .. i)
end

function JSON.decode(s)
    local v = parseValue(s, 1)
    return v
end

return JSON
