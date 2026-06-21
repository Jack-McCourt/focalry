--[[
    Info.lua — Wedding App Lightroom Classic plugin manifest.
]]

return {
    LrSdkVersion = 13.0,
    LrSdkMinimumVersion = 6.0,

    LrToolkitIdentifier = 'net.jackonthe.weddingapp',
    LrPluginName = 'Wedding App',
    LrPluginInfoUrl = 'https://wedding-app.jackonthe.net',

    LrExportServiceProvider = {
        title = 'Wedding App',
        file = 'WeddingAppPublishServiceProvider.lua',
    },

    VERSION = { major = 1, minor = 0, revision = 0, build = 1 },
}
