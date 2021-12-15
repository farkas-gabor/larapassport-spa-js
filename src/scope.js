const dedupe = arr => Array.from(new Set(arr));

export const getUniqueScopes = (...scopes) => {
    return dedupe(scopes.join(' ').trim().split(/\s+/)).join(' ');
};
