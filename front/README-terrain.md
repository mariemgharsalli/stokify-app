# Stokify Terrain — essai sur téléphone

PWA magasinier, scope `/terrain/`. Le service worker ne précache que le statique : aucun appel `/api` n'est mis en cache.

## 1. HTTPS local (caméra)

La caméra est bloquée en HTTP dès que la page n'est pas ouverte en `localhost`. Dans `front/.env.local` :

```
VITE_DEV_HTTPS=true
```

Puis, depuis `front/` :

```
npm run dev
```

Sur le téléphone (même Wi-Fi), ouvrir `https://<IP-du-PC>:5173/terrain`. Accepter le certificat auto-signé.

L'API passe par le proxy Vite `/api` : `services/api.js` bascule déjà dessus quand l'hôte n'est pas localhost. Le backend doit tourner sur la cible `VITE_PROXY_TARGET` (défaut `http://127.0.0.1:5000`).

## 2. PWA installée (service worker)

Le service worker n'est pas actif avec `npm run dev` (`devOptions.enabled: false`). Pour le tester :

```
npm run build
npm run preview -- --host
```

Ouvrir `http://<IP-du-PC>:4173/terrain` (ou HTTPS si vous avez un certificat devant le preview).

Contrôle : DevTools → Application → Cache Storage. Les fichiers JS/CSS/HTML du précache sont là. Il ne doit pas y avoir de réponses `/api`.

## 3. Installation

- Android Chrome : menu → « Installer l'application ». L'icône ouvre `/terrain/` en plein écran.
- iPhone Safari : bouton Partager → « Sur l'écran d'accueil ». Ouvrir d'abord `/terrain`, Safari mémorise l'URL courante. Le scan iPhone utilise le repli `@zxing/browser` (pas de `BarcodeDetector`).

## 4. Icônes

```
npm run pwa:icons
```

Source, dans l'ordre : `src/assets/logo-stokify.png` (cible de `scripts/copy-logo.mjs`), `public/logo-stokify.png`, puis `public/logos/`. Si rien n'est trouvé, le script écrit un monogramme « S » et affiche `PWA_ICON_PLACEHOLDER`.
