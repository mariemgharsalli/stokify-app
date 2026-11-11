# Déploiement Stokify

Ce document décrit la production actuelle. Il ne contient aucune valeur de secret : seulement des noms de variables, des URL publiques et des chemins de configuration.

## Architecture

Trois services, un dépôt privé.

| Élément | Emplacement | Rôle |
| --- | --- | --- |
| Front | Vercel, projet `stokify`, racine `front/` | React, Vite, PWA |
| Back | Railway, projet `stokify`, service `back`, racine `/back` | Express, Prisma, une seule instance |
| IA | Railway, même projet, service `ai-service`, racine `/ai-service` | FastAPI, image Docker |
| Base | Railway, service `MySQL` | MySQL 8, volume sur `/var/lib/mysql` |

Le back est toujours allumé à cause de `node-cron`. Il ne doit y avoir qu’une seule réplique : une deuxième instance enverrait les relances, les alertes et les entraînements en double. Le build est `npm ci && npx prisma generate`, le démarrage est `node src/server.js`. Aucune migration Prisma n’est lancée au build ni au démarrage.

Le volume du back s’appelle `back-volume` et est monté sur `/data`. Les fichiers servis sous `/uploads` sont lus depuis le chemin indiqué par `UPLOAD_ROOT`. Au premier démarrage, les images du dépôt sont copiées vers ce volume sans écraser ce qui existe déjà.

Le service IA est joignable depuis le back par le réseau privé Railway, port 8080. Ses routes métier exigent l’en-tête `X-AI-Key`. `GET /health` et `GET /ready` sont publics sur ce service. Les modèles d’expiration (`.joblib`, `.pt`) sont dans l’image. Les modèles d’anomalies (`.pkl`) ne sont pas dans Git : ils sont entraînés à la demande, pas au démarrage du processus.

## URL

- Front : `https://stokify-coral.vercel.app`
- Back : `https://back-production-a98111a6.up.railway.app`
- Santé du back : `GET /health`
- Santé de l’IA : `GET /health` sur le service `ai-service` (réseau privé)
- Dépôt de déploiement : `mariemgharsalli/stokify-app`, branche `main`, remote local `stokify-prod`
- L’ancien dépôt public `mariemgharsalli/Stokify` n’est pas utilisé pour cette production

Un rafraîchissement de `/terrain` renvoie la page HTML (200). Le prévol CORS `OPTIONS /api/runtime/qr-origin` avec l’origine du front renvoie cette origine dans `Access-Control-Allow-Origin`. Une image réelle sous `/uploads/articles/` renvoie 200.

## Variables

Noms seulement. Les saisir dans le tableau de bord ou la CLI du service concerné, jamais dans Git.

### Back (Railway)

Posées en production :

- `NODE_ENV`
- `UPLOAD_ROOT`
- `DATABASE_URL` (référence vers `MySQL.MYSQL_URL`, avec le jeu de caractères `utf8mb4`)
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `AI_SERVICE_KEY`
- `AI_SERVICE_URL`
- `SMTP_FROM_NAME`
- `PUBLIC_API_URL`
- `GROQ_API_KEY`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `FRONTEND_URL`

`FRONTEND_URL` est l’URL du front, sans slash final. Plusieurs origines sont possibles, séparées par des virgules. `AI_SERVICE_KEY` a la même valeur que sur le service IA.

Lues par le code si on les définit, non requises pour le déploiement actuel : `PORT`, `HOST`, `GROQ_TIMEOUT_MS`, `GROQ_CHAT_MODEL`, `SMTP_HOST`, `EMAIL_LOGO_URL`, `FRONT_URL`, `DISABLE_RELANCES`, `DISABLE_DLC_ALERT`, `DISABLE_EXPIRY_CRON`, `DISABLE_STOCK_ALERTS`, `DISABLE_ANOMALIES_CRON`.

### MySQL (Railway)

- `MYSQL_URL` est la variable référencée par le back. Ne pas ouvrir de shell SQL depuis les outils de déploiement.

### IA (Railway)

Posées :

- `AI_ENV`
- `AI_SERVICE_KEY`

Lues par le code, avec une valeur par défaut si elles sont absentes : `AI_MAX_HEAVY`, `EXPIRY_MODELS_DIR`, `EXPIRY_AUTOTRAIN`, `AI_NBEATS_CACHE`, `PORT`.

### Front (Vercel, environnement Production)

Ces noms sont intégrés au build Vite. Un changement exige un nouveau déploiement de production.

- `VITE_API_BASE_URL`
- `VITE_PUBLIC_URL`

## Redéployer

Back ou IA, après un changement de code poussé sur `main` : Railway reconstruit le service branché au dépôt. Après un changement de variable seulement : redéployer le service concerné, sans augmenter le nombre de répliques du back.

Front : depuis `front/`, `vercel deploy --prod`. Les variables `VITE_*` doivent déjà exister sur le projet Vercel avant ce build.

Le dépôt GitHub est déjà branché à Railway pour `back` et `ai-service`. Vercel a été déployé par la CLI, pas par une liaison Git. Pour un déploiement Vercel à chaque push sur `main`, connecter le dépôt dans le tableau de bord Vercel et fixer le répertoire racine à `front`.

## Retour arrière

Railway : onglet Deployments du service, redeploy du déploiement précédent qui était en succès. Ne pas lancer un second back pendant que l’ancien tourne encore.

Vercel : promouvoir un déploiement de production antérieur depuis le tableau de bord du projet `stokify`.

Base : ne pas exécuter `prisma migrate dev`, `prisma migrate reset` ni `prisma db seed` sur la base en ligne. Après un import complet d’un dump, `prisma migrate deploy` n’est pas nécessaire. Un dump local (`mysqldump`) ne modifie pas la base locale.

## Points d’attention

- Une seule instance du back.
- Le plan d’essai Railway peut mettre un service en veille. Le back ne doit pas s’endormir tant que les crons sont actifs.
- Les fichiers `.pkl` d’anomalies ne sont pas dans l’image. Les prévisions d’anomalies entraînées localement restent absentes tant qu’un entraînement n’a pas été relancé en production.
- L’ancien dépôt public contient encore l’historique d’un ancien fichier d’environnement. Ne pas le pousser, ne pas le réécrire. Les clés qui y ont figuré doivent rester celles déjà révoquées.
- Aucun fichier `.env` réel ne doit être lu, commité ou collé dans une issue.
