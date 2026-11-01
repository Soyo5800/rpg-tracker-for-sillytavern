import { extension_settings } from "../../../extensions.js";
import { loadSettings, backupSettingsToLocalStorage, syncRpgTrackerRegex } from "./src/core/ExtensionSettings.js";
import { clearAllExtensionPrompts, registerLifecycleEvents } from "./src/core/ExtensionLifecycle.js";
import { establishBridgeConnection } from "./src/core/ExtensionBridge.js";
import { startChatObserver, registerChatEvents, triggerObserverNow } from "./src/core/ExtensionObserver.js";
import { registerContextInterceptor } from "./src/core/ContextManager.js";
import { restoreExtensionPromptForCurrentMode } from "./src/core/ModelManager.js";
import { registerMessageCardClickEvent } from "./src/messagetracker/MessageCardRenderer.js";

export default 'RPGTracker';

const extensionPath = import.meta.url.substring(0, import.meta.url.lastIndexOf('/'));
const extensionName = extensionPath.substring(extensionPath.lastIndexOf('/') + 1);

if (window.RPG_TRACKER_INITIALIZED) {
    console.warn("[RPG Tracker] Extension already initialized. Skipping duplicate startup.");
} else {
    window.RPG_TRACKER_INITIALIZED = true;

    registerContextInterceptor(extensionName);

    async function initReactApp() {
        $('#my-rpg-react-root').remove();
        $('body').append('<div id="my-rpg-react-root" style="position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 9999; pointer-events: none;"></div>');
        try {
            await import(`${extensionPath}/dist/bundle.js?v=${Date.now()}`);
        } catch (err) {
            console.error("[RPG Tracker] Exception occurred while mounting React app:", err);
        }
    }

    jQuery(async () => {
        try {
            const extensionsettingsHtml = await $.get(`${extensionPath}/extension-settings.html`);
            if ($("#extensions_settings2 .rpg-tracker-settings").length === 0) {
                $("#extensions_settings2").append(extensionsettingsHtml);
            }

            $("#rpg_tracker_enabled").off("input").on("input", (event) => {
                const isChecked = Boolean($(event.target).prop("checked"));
                extension_settings[extensionName] = extension_settings[extensionName] || {};
                extension_settings[extensionName].enabled = isChecked;
                backupSettingsToLocalStorage(extensionName);

                if (!isChecked) {
                    $('#rpg-message-card-styles').remove();
                    $('.rpg-msg-card-container, .rpg-snapshot-btn').remove();
                    clearAllExtensionPrompts(extensionName);
                }

                if (window.RPGBridge && typeof window.RPGBridge.syncSettings === 'function') {
                    window.RPGBridge.syncSettings(extension_settings[extensionName]);
                }
                syncRpgTrackerRegex(isChecked);

                if (isChecked) {
                    restoreExtensionPromptForCurrentMode(extensionName);
                    triggerObserverNow();
                }
            });
        } catch (err) {
            console.error("[RPG Tracker] Failed to load settings template", err);
        }

        await loadSettings(extensionName);
        establishBridgeConnection(extensionName);
        await initReactApp();

        registerMessageCardClickEvent();

        registerLifecycleEvents(extensionName);
        registerChatEvents();
        startChatObserver(extensionName);

        setTimeout(() => triggerObserverNow(), 500);
    });
}