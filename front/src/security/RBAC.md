# Contrôle d'accès par rôle (RBAC) — Stokify

Les permissions sont déclarées dans `front/src/security/permissions.js` (navigation et guards UI) et `back/src/middleware/rbac.js` (guards API). Le JWT contient `role` et `societeId` ; les routes API vérifient `can("module:action")`.

> **Note :** `SUPER_ADMIN` et `CLIENT` sont des rôles additionnels au-delà des quatre rôles métier du cahier des charges (section 22) : multi-société pour la plateforme, et portail client externe respectivement.

## Matrice d'accès aux interfaces

| Interface | SUPER_ADMIN | ADMIN | RESPONSABLE | MAGASINIER | COMPTABLE | CLIENT |
|---|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | (accueil propre) |
| Articles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ lecture seule |
| Stock | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Dépôts / Plan | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Marques / Familles | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Lots / N° série / Rappel | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Inventaires | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Mouvements | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Fournisseurs | ✓ | ✓ | ✓ | ✓ | ✓ lecture seule | ✗ |
| Achats | ✓ | ✓ | ✓ | ✓ | ✓ lecture seule | ✗ |
| Comparaison fournisseurs | ✓ | ✓ | ✓ | ✓ | ✓ lecture seule | ✗ |
| Clients / Gestion clients | ✓ | ✓ | ✓ | ✓ | ✓ lecture seule | ✗ |
| Ventes | ✓ | ✓ | ✓ | ✓ | ✓ lecture seule | ✗ |
| Encours clients | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Règlements | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Coût de stockage | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Valorisation | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Rentabilité | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ |
| Rapports | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Module IA | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Comptabilité | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| Utilisateurs | ✓ | ✓ (sa société) | ✗ | ✗ | ✗ | ✗ |
| Journal audit | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Sociétés | ✓ complet | ✓ lecture seule | ✗ | ✗ | ✗ | ✗ |
| Commandes (orders) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

## Rôles (cahier des charges — section 22)

### Administrateur (`ADMIN`, `SUPER_ADMIN`)

L'administrateur dispose d'un accès complet à la gestion de sa société : utilisateurs, stock, achats/ventes, valorisation, rapports, IA et comptabilité. Il gère les règlements et consulte les encours clients. `SUPER_ADMIN` possède la permission `*` (toutes les actions) et peut administrer les sociétés ; `ADMIN` ne gère que les utilisateurs de sa société et consulte les sociétés en lecture seule.

### Magasinier (`MAGASINIER`)

Le magasinier intervient sur le terrain : articles, stock, dépôts, lots, inventaires et mouvements. Il saisit et confirme achats et ventes opérationnelles, consulte fournisseurs et clients, mais n'accède pas aux écrans financiers (encours, règlements, valorisation, rentabilité, comptabilité, rapports, IA).

### Comptable (`COMPTABLE`)

Le comptable consulte le stock en lecture seule (sans modification des lignes de stock). Il accède aux achats et ventes en consultation, aux fournisseurs et clients en lecture, ainsi qu'aux écrans financiers : encours clients, règlements, coût de stockage, valorisation, rentabilité et comptabilité. Il ne peut pas créer ni confirmer d'achats/ventes ni accéder aux mouvements, rapports ou module IA.

### Responsable logistique (`RESPONSABLE`)

Le responsable logistique supervise l'ensemble de la chaîne logistique et commerciale opérationnelle : stock multi-dépôts, mouvements, achats, ventes, fournisseurs, clients, inventaires, valorisation et rentabilité. Il pilote les règlements et les encours, consulte les rapports et le module IA, et peut lire la liste des utilisateurs. Il n'accède pas à la comptabilité, à la gestion des utilisateurs, au journal d'audit ni à la console sociétés.

### Client (`CLIENT`) — rôle additionnel

Le client externe accède uniquement au catalogue articles (lecture) et à ses commandes via le portail dédié (`orders:read`, `orders:write`). Aucun accès au stock interne, aux dépôts ni aux modules back-office.

## Permissions techniques clés

| Permission | Usage |
|---|---|
| `stock:read` / `stock:write` | Consultation / modification stock, dépôts, articles |
| `mouvements:write` | Écran Mouvements (entrées/sorties) |
| `achats:read` / `achats:write` | Liste achats / création et confirmation |
| `ventes:read` / `ventes:write` | Liste ventes / création et confirmation |
| `valorisation:read` | Coût stockage, valorisation, rentabilité |
| `encours:read` | Page Encours clients |
| `reglements:write` | Page Règlements |
| `accounting:read` | Module Comptabilité |
| `rapports:read` | Rapports |
| `ai:read` | Module IA |
| `users:manage` | Gestion utilisateurs + journal audit |
| `companies:read` | Consultation sociétés (ADMIN) |
| `orders:read` / `orders:write` | Portail commandes client |

Les écarts entre rôles sont appliqués dans la **sidebar**, les **guards de route** (`PermissionPage`, `RequireNonClient`, etc.) et les **actions conditionnelles** dans les pages (ex. boutons masqués si pas `achats:write`).
