// Deep clone helper for JSON-serializable objects
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Safely updates a nested object value along a path array
 * @param {Object} obj - Source object (e.g. character)
 * @param {Array<string|number>} pathArray - Target path (e.g. ['inventory', 'storage', 'backpack'])
 * @param {any} value - Value to set
 * @returns {Object} - Cloned and mutated new object
 */
export function setNestedValue(obj, pathArray, value) {
    const cloned = deepClone(obj);
    let current = cloned;

    for (let i = 0; i < pathArray.length - 1; i++) {
        const key = pathArray[i];
        // Create intermediate path if not present (array for numeric keys, object otherwise)
        if (current[key] === undefined || current[key] === null) {
            current[key] = typeof pathArray[i + 1] === 'number' ? [] : {};
        }
        current = current[key];
    }

    current[pathArray[pathArray.length - 1]] = value;
    return cloned;
}