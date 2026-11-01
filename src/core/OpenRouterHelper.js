/**
 * In-memory cache for OpenRouter model provider endpoints.
 */
const modelProviderCache = new Map();

/**
 * Retrieves the general OpenRouter provider list from SillyTavern UI elements, global settings, or fallback list.
 */
export function getAvailableOpenRouterProviders() {
    const providers = [];
    try {
        $('#openrouter_providers_chat option').each(function () {
            const val = $(this).val();
            if (val && typeof val === 'string' && !providers.includes(val)) {
                providers.push(val);
            }
        });

        if (providers.length === 0 && Array.isArray(window.oai_settings?.openrouter_providers)) {
            window.oai_settings.openrouter_providers.forEach(p => {
                if (p && typeof p === 'string' && !providers.includes(p)) {
                    providers.push(p);
                }
            });
        }

        if (providers.length === 0) {
            return [
                "DeepInfra", "Together", "Fireworks", "Lepton", "Chutes",
                "Novita", "Hyperbolic", "Avian", "Groq", "Baseten", "Cerebras", "Lambda",
                "Nebius", "SambaNova", "Mistral", "Anthropic", "OpenAI"
            ];
        }
    } catch (e) {
        console.warn("[RPG Tracker] Failed to extract OpenRouter providers:", e);
    }
    return providers;
}

/**
 * Dynamically fetches the list of hosting providers that currently serve the specified OpenRouter model.
 */
export async function fetchProvidersForOpenRouterModel(modelId) {
    if (!modelId || typeof modelId !== 'string') return getAvailableOpenRouterProviders();
    const cleanModel = modelId.trim();

    if (cleanModel === 'OR_Website' || !cleanModel.includes('/')) {
        return getAvailableOpenRouterProviders();
    }

    // Check in-memory cache first
    if (modelProviderCache.has(cleanModel)) {
        return modelProviderCache.get(cleanModel);
    }

    // Check SillyTavern DOM if the selected model matches SillyTavern's active model
    const stCurrentModel = $('#model_openrouter_select').val();
    if (stCurrentModel === cleanModel) {
        const domProviders = [];
        const totalOptions = $('#openrouter_providers_chat option').length;

        $('#openrouter_providers_chat option').each(function () {
            // Only collect options that are not disabled by SillyTavern
            if (!this.disabled && this.value && typeof this.value === 'string') {
                domProviders.push(this.value);
            }
        });

        // Use DOM list only if SillyTavern has actively applied filtering
        if (domProviders.length > 0 && domProviders.length < totalOptions) {
            domProviders.sort((a, b) => a.localeCompare(b));
            modelProviderCache.set(cleanModel, domProviders);
            return domProviders;
        }
    }

    // Query OpenRouter official API endpoints directly
    try {
        // Encode model path segments while preserving slashes to prevent 404
        const modelPath = cleanModel.split('/').map(encodeURIComponent).join('/');
        const resp = await fetch(`https://openrouter.ai/api/v1/models/${modelPath}/endpoints`, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'force-cache'
        });

        if (resp.ok) {
            const data = await resp.json();
            const endpoints = data?.data?.endpoints || [];
            const providers = endpoints
                .map(ep => ep.provider_name || ep.name)
                .filter((p, idx, arr) => p && typeof p === 'string' && arr.indexOf(p) === idx);

            if (providers.length > 0) {
                providers.sort((a, b) => a.localeCompare(b));
                modelProviderCache.set(cleanModel, providers);
                return providers;
            }
        }
    } catch (e) {
        console.warn("[RPG Tracker] Failed to fetch endpoints from OpenRouter:", e);
    }

    return getAvailableOpenRouterProviders();
}