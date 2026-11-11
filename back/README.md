# Stokify — Backend API

## Démarrage

```bash
cp .env.example .env   # puis adapter DATABASE_URL et JWT_SECRET
npm install
npx prisma migrate deploy
npx prisma db seed
```

### Développement (recommandé)

```bash
npm run dev
```

Utilise **nodemon** (`src/server.js`) : le serveur se recharge automatiquement quand vous modifiez routes, controllers ou services.

### Production / démarrage manuel

```bash
npm start
```

Équivalent à `node src/server.js`. **Aucun rechargement automatique** : après toute modification de routes (ex. `POST /api/articles/import`), vous devez **arrêter et relancer** le process Node, sinon le client recevra un **404** sur les nouvelles routes alors que l’ancien code tourne encore en mémoire.

> **Cause typique des 404 après ajout d’une route** : le backend a été lancé avec `node server.js` (ou un ancien terminal) avant que le nouveau fichier de routes soit pris en compte. Solution : redémarrer le serveur, ou utiliser `npm run dev` pendant le développement.

## Import CSV produits

- **Endpoint** : `POST /api/articles/import` (multipart, champ `file`, auth + permission `stock:write`)
- **Test multi-lignes automatisé** (sans serveur HTTP) :

```bash
node scripts/test-import-csv.js
```

Le script génère un CSV de ~10 lignes (succès + erreurs partielles), appelle `importArticlesFromCsv` et affiche `{ success, failed, errors: [{ line, message }] }`.

## Santé

- `GET /health` — connexion MySQL
- `GET /api` — liste des modules montés
