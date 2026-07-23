export const IDENTITY_TOKEN_KEY = "lifeos.identityToken";
export const IDENTITY_ALIAS_KEY = "lifeos.selectedIdentityAlias";

export function readIdentityToken() {
  return localStorage.getItem(IDENTITY_TOKEN_KEY);
}

export function storeIdentity(token: string, alias: string) {
  localStorage.setItem(IDENTITY_TOKEN_KEY, token);
  localStorage.setItem(IDENTITY_ALIAS_KEY, alias);
}

export function clearIdentity() {
  localStorage.removeItem(IDENTITY_TOKEN_KEY);
  localStorage.removeItem(IDENTITY_ALIAS_KEY);
}
