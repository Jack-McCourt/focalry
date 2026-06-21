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

-- Pixieset-style naming in the Publish panel: a "Collection" is the gallery
-- (Lightroom collection set) and the "Sets" inside it are its sets (Lightroom
-- published collections). This drives the right-click "Create …" menu labels.
provider.titleForPublishedCollection = 'Set'
provider.titleForPublishedSmartCollection = 'Smart Set'
provider.titleForPublishedCollectionSet = 'Collection'
provider.titleForGoToPublishedCollection = 'Show Set in Wedding App'

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
        -- A "Collection" (Lightroom collection set) = a gallery; the "Sets"
        -- (published collections) inside it = its sets. A top-level Set with no
        -- parent Collection is treated as a simple single-set gallery.
        defaultCollectionName = 'Untitled Set',
        defaultCollectionCanBeDeleted = true,
        canAddCollection = true,
        maxCollectionSetDepth = 1,
    }
end

local function createGallery(settings, name, createDefaultSet)
    local status, data = API.createCollection(settings.serverUrl, settings.token, name, createDefaultSet)
    if status ~= 201 or not data or not data.collection then
        LrErrors.throwUserError('Could not create the gallery "' .. tostring(name) .. '" (HTTP ' .. tostring(status) .. ').')
    end
    return data.collection.id
end

-- Resolve the remote gallery id + set id for the collection being published,
-- creating whatever doesn't exist yet and caching the ids back onto Lightroom.
--   • collection inside a set →  set's parent = gallery, collection = a set
--   • top-level collection    →  the collection itself = a gallery (no set)
local function ensureGalleryAndSet(exportContext, settings)
    local info = exportContext.publishedCollectionInfo
    local publishedCollection = exportContext.publishedCollection
    local catalog = LrApplication.activeCatalog()

    local parentInfo = info.parents and info.parents[#info.parents] or nil

    if not parentInfo then
        -- Top-level published collection → a gallery with the default set.
        local galleryId = info.remoteId
        if not galleryId then
            galleryId = createGallery(settings, info.name, true)
            catalog:withWriteAccessDo('Link Wedding App gallery', function()
                publishedCollection:setRemoteId(galleryId)
                publishedCollection:setRemoteUrl(settings.serverUrl .. '/collections/' .. tostring(galleryId))
            end, { timeout = 30 })
        end
        return galleryId, nil
    end

    -- Nested: parent collection set = gallery, this collection = a set in it.
    local galleryId = parentInfo.remoteCollectionId
    if not galleryId then
        galleryId = createGallery(settings, parentInfo.name, false)
        local parentSet = publishedCollection:getParent()
        if parentSet then
            catalog:withWriteAccessDo('Link Wedding App gallery', function()
                parentSet:setRemoteId(galleryId)
                parentSet:setRemoteUrl(settings.serverUrl .. '/collections/' .. tostring(galleryId))
            end, { timeout = 30 })
        end
    end

    local setId = info.remoteId
    if not setId then
        local status, data = API.createSet(settings.serverUrl, settings.token, galleryId, info.name)
        if status ~= 201 or not data or not data.set then
            LrErrors.throwUserError('Could not create the set "' .. tostring(info.name) .. '" (HTTP ' .. tostring(status) .. ').')
        end
        setId = data.set.id
        catalog:withWriteAccessDo('Link Wedding App set', function()
            publishedCollection:setRemoteId(setId)
        end, { timeout = 30 })
    end

    return galleryId, setId
end

function provider.processRenderedPhotos(functionContext, exportContext)
    local settings = exportContext.propertyTable

    if not settings.token or settings.token == '' then
        LrErrors.throwUserError('Please sign in to Wedding App in the publish service settings first.')
    end

    local galleryId, setId = ensureGalleryAndSet(exportContext, settings)

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
            local pStatus, pData = API.presign(settings.serverUrl, settings.token, galleryId, filename, 'image/jpeg', fileSize)
            if pStatus ~= 200 or not pData or not pData.url then
                local msg = (pData and pData.message) or ('presign failed (HTTP ' .. tostring(pStatus) .. ')')
                rendition:uploadFailed(msg)
            else
                -- 2. PUT the file directly to Wasabi.
                local uStatus = API.uploadToWasabi(pData.url, pData.headers, filePath, 'image/jpeg')
                if uStatus < 200 or uStatus >= 300 then
                    rendition:uploadFailed('upload to storage failed (HTTP ' .. tostring(uStatus) .. ')')
                else
                    -- 3. Register the photo (into its set) so the app queues derivatives.
                    local rStatus, rData = API.registerPhoto(settings.serverUrl, settings.token, galleryId, filename, pData.key, fileSize, setId)
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
