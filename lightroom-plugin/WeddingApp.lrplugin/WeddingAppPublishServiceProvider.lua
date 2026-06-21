--[[
    WeddingAppPublishServiceProvider.lua

    Lightroom Classic Publish Service for the Wedding App. Galleries appear in
    the Publish panel; dragging photos in and clicking "Publish" renders JPEGs
    and pushes them to the studio's gallery:

        presign  →  PUT to Wasabi  →  register photo (queues derivatives)

    Auth is email + password exchanged once for a Sanctum token, stored in the
    publish service settings.
]]

local LrApplication = import 'LrApplication'
local LrDialogs = import 'LrDialogs'
local LrErrors = import 'LrErrors'
local LrFileUtils = import 'LrFileUtils'
local LrPathUtils = import 'LrPathUtils'
local LrTasks = import 'LrTasks'
local LrView = import 'LrView'
local LrFunctionContext = import 'LrFunctionContext'

local API = require 'WeddingAppAPI'

local DEFAULT_SERVER_URL = 'https://wedding-app.jackonthe.net'

local provider = {}

-- Publish-only service (no plain "Export to disk" entry).
provider.supportsIncrementalPublish = 'only'

-- We only ever push web-sized sRGB JPEGs; the gallery makes its own derivatives.
provider.hideSections = { 'exportLocation', 'video' }
provider.allowFileFormats = { 'JPEG' }
provider.allowColorSpaces = { 'sRGB' }
provider.canExportVideo = false
provider.hidePrintResolution = true

provider.exportPresetFields = {
    { key = 'serverUrl', default = DEFAULT_SERVER_URL },
    { key = 'email', default = '' },
    { key = 'token', default = '' },
    { key = 'accountName', default = '' },
}

-- Re-publish a photo if it's edited in the develop module.
provider.metadataThatTriggersRepublish = function()
    return { default = false }
end

-- ── Account / login dialog ────────────────────────────────────────────────

local function refreshStatus(propertyTable)
    if propertyTable.token and propertyTable.token ~= '' then
        propertyTable.accountStatus = 'Signed in as ' .. (propertyTable.accountName ~= '' and propertyTable.accountName or propertyTable.email)
        propertyTable.loginButtonTitle = 'Sign out'
        propertyTable.loggedIn = true
    else
        propertyTable.accountStatus = 'Not signed in'
        propertyTable.loginButtonTitle = 'Sign in'
        propertyTable.loggedIn = false
    end
end

function provider.startDialog(propertyTable)
    refreshStatus(propertyTable)
end

local function doLogin(propertyTable)
    LrTasks.startAsyncTask(function()
        if propertyTable.loggedIn then
            propertyTable.token = ''
            propertyTable.accountName = ''
            refreshStatus(propertyTable)
            return
        end

        if not propertyTable.email or propertyTable.email == '' or not propertyTable.password or propertyTable.password == '' then
            LrDialogs.message('Enter your email and password first.', nil, 'warning')
            return
        end

        propertyTable.accountStatus = 'Signing in…'
        local status, data = API.login(propertyTable.serverUrl, propertyTable.email, propertyTable.password)

        if status == 200 and data and data.token then
            propertyTable.token = data.token
            propertyTable.accountName = (data.studio and data.studio.name) or (data.user and data.user.name) or propertyTable.email
            propertyTable.password = ''
            refreshStatus(propertyTable)
            LrDialogs.message('Connected to Wedding App.', propertyTable.accountStatus, 'info')
        else
            local msg = 'Sign in failed (HTTP ' .. tostring(status) .. ').'
            if data and data.message then msg = data.message end
            refreshStatus(propertyTable)
            LrDialogs.message('Could not sign in', msg, 'error')
        end
    end)
end

function provider.sectionsForTopOfDialog(f, propertyTable)
    local bind = LrView.bind
    return {
        {
            title = 'Wedding App Account',
            f:row {
                f:static_text { title = 'Server', width = LrView.share 'label_width' },
                f:edit_field { value = bind 'serverUrl', width_in_chars = 32, immediate = true },
            },
            f:row {
                f:static_text { title = 'Email', width = LrView.share 'label_width' },
                f:edit_field { value = bind 'email', width_in_chars = 32, immediate = true },
            },
            f:row {
                f:static_text { title = 'Password', width = LrView.share 'label_width' },
                f:password_field { value = bind 'password', width_in_chars = 32, immediate = true },
            },
            f:row {
                f:static_text { title = '', width = LrView.share 'label_width' },
                f:static_text { title = bind 'accountStatus', fill_horizontal = 1 },
                f:push_button {
                    title = bind 'loginButtonTitle',
                    action = function() doLogin(propertyTable) end,
                },
            },
        },
    }
end

-- ── Publish behaviour ─────────────────────────────────────────────────────

function provider.getCollectionBehaviorInfo(publishSettings)
    return {
        defaultCollectionName = 'New Gallery',
        defaultCollectionCanBeDeleted = true,
        canAddCollection = true,
        maxCollectionSetDepth = 0, -- flat list of galleries
    }
end

-- Map this published collection to a remote gallery, creating one on first use.
local function ensureRemoteCollection(exportContext, settings)
    local info = exportContext.publishedCollectionInfo
    local remoteId = info.remoteId

    if remoteId then return remoteId end

    local status, data = API.createCollection(settings.serverUrl, settings.token, info.name)
    if status ~= 201 or not data or not data.collection then
        LrErrors.throwUserError('Could not create the gallery on the server (HTTP ' .. tostring(status) .. ').')
    end

    remoteId = data.collection.id

    local catalog = LrApplication.activeCatalog()
    catalog:withWriteAccessDo('Link Wedding App gallery', function()
        exportContext.publishedCollection:setRemoteId(remoteId)
        exportContext.publishedCollection:setRemoteUrl(settings.serverUrl .. '/collections/' .. tostring(remoteId))
    end, { timeout = 30 })

    return remoteId
end

function provider.processRenderedPhotos(functionContext, exportContext)
    local settings = exportContext.propertyTable

    if not settings.token or settings.token == '' then
        LrErrors.throwUserError('Please sign in to Wedding App in the publish service settings first.')
    end

    local remoteCollectionId = ensureRemoteCollection(exportContext, settings)

    local nPhotos = exportContext.exportSession:countRenditions()
    local progress = exportContext:configureProgress({
        title = nPhotos > 1 and ('Uploading ' .. nPhotos .. ' photos to Wedding App') or 'Uploading 1 photo to Wedding App',
    })

    for i, rendition in exportContext:renditions { stopIfCanceled = true } do
        progress:setPortionComplete(i - 1, nPhotos)

        local rendered, pathOrMessage = rendition:waitForRender()
        if rendered then
            local filePath = pathOrMessage
            local filename = LrPathUtils.leafName(filePath)
            local attrs = LrFileUtils.fileAttributes(filePath)
            local fileSize = attrs and attrs.fileSize or nil

            -- 1. Ask the app for a presigned Wasabi URL.
            local pStatus, pData = API.presign(settings.serverUrl, settings.token, remoteCollectionId, filename, 'image/jpeg', fileSize)
            if pStatus ~= 200 or not pData or not pData.url then
                local msg = (pData and pData.message) or ('presign failed (HTTP ' .. tostring(pStatus) .. ')')
                rendition:uploadFailed(msg)
            else
                -- 2. PUT the file directly to Wasabi.
                local uStatus = API.uploadToWasabi(pData.url, pData.headers, filePath)
                if uStatus < 200 or uStatus >= 300 then
                    rendition:uploadFailed('upload to storage failed (HTTP ' .. tostring(uStatus) .. ')')
                else
                    -- 3. Register the photo so the app queues derivatives.
                    local rStatus, rData = API.registerPhoto(settings.serverUrl, settings.token, remoteCollectionId, filename, pData.key, fileSize)
                    if rStatus ~= 201 or not rData or not rData.photo then
                        local msg = (rData and rData.message) or ('register failed (HTTP ' .. tostring(rStatus) .. ')')
                        rendition:uploadFailed(msg)
                    else
                        rendition:recordPublishedPhotoId(tostring(rData.photo.id))
                    end
                end
            end

            LrFileUtils.delete(filePath)
        end
    end

    progress:done()
end

-- Remove photos deleted from a published collection (or removed in LR) from the gallery.
function provider.deletePhotosFromPublishedCollection(publishSettings, arrayOfPhotoIds, deletedCallback)
    for _, photoId in ipairs(arrayOfPhotoIds) do
        local status = API.deletePhoto(publishSettings.serverUrl, publishSettings.token, photoId)
        -- 204 = deleted, 404 = already gone; treat both as success so LR clears it.
        if status == 200 or status == 204 or status == 404 then
            deletedCallback(photoId)
        end
    end
end

return provider
