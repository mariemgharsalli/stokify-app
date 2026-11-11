/** Remplace `virtual:pwa-register` pendant les tests Vitest. */
export function registerSW() {
  return () => {};
}
