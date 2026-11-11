# Extensions API Stokify (référence rapide)

Toutes les routes ci-dessous sont sous `http://<host>:<port>/api/` et nécessitent l’en-tête  
`Authorization: Bearer <JWT>` (sauf `auth`).

## Familles & sous-familles

- `GET /familles` — liste des familles.
- `POST /familles` — corps : `{ "code": "ELEC", "nom": "Électronique", "description": "..." }`.
- `GET /familles/sous-familles` — liste des sous-familles (avec parent).
- `POST /familles/sous-familles` — `{ "code": "CB", "nom": "Cartes", "familleId": 1 }`.

## Clients & fournisseurs

- `GET /clients` — pagination via `?page=&limit=`.
- `POST /clients` — `{ "code": "C001", "nom": "...", "email": "...", ... }`.
- `GET /fournisseurs` / `POST /fournisseurs` — même principe (champs métier selon validation backend).

## Lots (FIFO / FEFO)

- `GET /lots?articleId=1&limit=50`
- `POST /lots` — `{ "numero": "L-2026-001", "articleId": 1, "quantiteInitiale": 100, "dateExpiration": "2026-12-31" }`
- `GET /lots/preview-pick?articleId=1&quantite=10&strategie=FIFO` — prévisualisation sans écriture.
- `POST /lots/sortie-fifo-fefo` — exemple :

```json
{
  "articleId": 1,
  "depotId": 2,
  "quantite": 5,
  "strategie": "FEFO",
  "type": "SORTIE_AUTRE"
}
```

Réponse typique : détail des lots consommés + mouvement créé (selon implémentation service).

## Règlements (ventes & achats)

- `GET /reglements/ventes/12` — liste des règlements de la vente `12`.
- `POST /reglements/ventes/12` — `{ "montant": 150.5, "mode": "VIREMENT", "reference": "REF-1", "datePayment": "2026-04-12T10:00:00.000Z" }`  
  → met à jour `montantRegle` / `statutPaiement` sur la vente.
- `DELETE /reglements/vente-reglements/5`
- `GET|POST /reglements/achats/<achatId>` et `DELETE /reglements/achat-reglements/<id>` — miroir pour les achats (`ReglementAchat`).

## Marques

- `GET /marques`
- `POST /marques` — `{ "code": "SNY", "nom": "Sony" }`
- `PATCH /marques/:id` / `DELETE /marques/:id`

## Numéros de série

- `GET /numeros-serie?articleId=&statut=&search=`
- `POST /numeros-serie` — `{ "numero": "IMEI-...", "articleId": 1, "depotId": 2, "statut": "DISPONIBLE", "notes": "..." }`

## Coût de stockage

- `GET /cout-stockage?articleId=&depotId=`
- `POST /cout-stockage` — `periodeDebut` doit être une date ISO 8601 valide, ex. `"2026-04-01T00:00:00.000Z"` :

```json
{
  "articleId": 1,
  "depotId": 2,
  "coutUnitaire": 0.35,
  "devise": "TND",
  "periodeDebut": "2026-04-01T00:00:00.000Z",
  "periodeFin": null,
  "commentaire": "Location palette"
}
```

## Inventaires

- `POST /inventaires` — `{ "depotId": 1, "populateFromStock": true }`
- `POST /inventaires/3/lignes` — `{ "articleId": 5, "qteTheorique": 10, "qteReelle": 9 }`
- `PATCH /inventaires/3/lignes/7` — `{ "qteReelle": 9 }`
- `POST /inventaires/3/valider` — applique les écarts (stock + mouvements).

## Valorisation stock

- `GET /valuation/stock?methodePrix=PAHT` — `PAHT` | `PVHT` | `COUT_STOCKAGE`

Exemple de réponse :

```json
{
  "methodePrix": "PAHT",
  "total": 12540.5,
  "lignes": [
    {
      "articleId": 1,
      "articleCode": "ART-01",
      "articleLibelle": "Cable",
      "depotId": 2,
      "depotCode": "D1",
      "quantite": 100,
      "prixUnitaire": 2.5,
      "valeur": 250
    }
  ],
  "generatedAt": "2026-04-12T12:00:00.000Z"
}
```

## RBAC (rappel)

Les permissions exactes par rôle sont dans `back/src/middleware/rbac.js` (ex. `stock:read`, `reglements:write`, `reglements:*`, `valorisation:read`).
