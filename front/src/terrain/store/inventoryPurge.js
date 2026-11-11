const MASQUE_CLE = "stokify-terrain-inventaire-masque";
const SESSION_PREFIX = "stokify-terrain-inventaire-session:";

export function purgerInventaireLocal() {
  try {
    localStorage.removeItem(MASQUE_CLE);
  } catch {
    /* le navigateur peut refuser le stockage */
  }
  try {
    const keys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key && key.startsWith(SESSION_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* le navigateur peut refuser le stockage */
  }
}
