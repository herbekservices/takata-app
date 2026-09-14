# TAKATA — Application de terrain (collecte des déchets ménagers)

**Version 3.0** — Restyle « 11 Build » (luxe minimaliste) appliqué sur la structure existante · Produits adaptés au secteur de la collecte · Modèle de rôles complet.

> Le partenaire de votre confort, au soin de notre environnement.

---

## 1. Démarrage

```bash
npm install          # une seule fois (better-sqlite3, express, compression)
npm run seed         # réinitialise la base avec les données de démonstration
npm start            # démarre le serveur → http://localhost:8080
```

- Santé : `GET /api/health` → `{"ok":true,"app":"TAKATA","db":"sqlite"}`
- Base : SQLite fichier `data/takata.db` (WAL). `npm run seed -- --reset` efface et re-seed.

## 2. Comptes de démonstration (par rôle)

| Rôle | Identifiant | Mot de passe | Périmètre |
|---|---|---|---|
| **Direction (adminGEN)** | `admin` | `admin123` | Voit **tous les mouvements** de toutes les équipes ; crée des comptes de tout type (commerciaux, techniciens, superviseurs, direction). |
| **Superviseur commercial (admin1/admincomm)** | `admincomm` | `admincomm123` | Voit l'ensemble des **équipes commerciales** (agents, clients, encaissements, prospects) ; crée des commerciaux. |
| **Superviseur technique (admin2/admintech)** | `admintech` | `admintech123` | Voit l'ensemble des **équipes techniques** (techniciens, matériel) ; crée des techniciens. |
| **Commercial (agent)** | `agent1` / `agent2` / `agent3` | `agent123` | Voit **son portefeuille uniquement** : ses clients, prospects, abonnements, encaissements, commissions. |
| **Technicien** | `technicien1` / `technicien2` | `tech123` | Voit **les tournées** (tous les abonnements en service, en lecture) et le **matériel** (intrants) ; aucune action de vente ni d'encaissement. |

> Règle de sécurité : un superviseur ne peut créer que des comptes de son périmètre (admincomm → commerciaux, admintech → techniciens). Toute tentative d'élévation est **forcée** au rôle autorisé. Seule la direction crée des superviseurs/direction.

## 3. Produits (secteur collecte)

| Formule / intrant | Tarif | Fonctionnement |
|---|---|---|
| **Abonnement Standard** (2 collectes/sem, sacs fournis, désinfection incluse) | **20 000 FC/mois** | Échéancier mensuel (12 redevances), 1ʳᵉ semaine gratuite selon politique commerciale |
| **Abonnement Premium** (3 collectes/sem + désinfection renforcée) | **35 000 FC/mois** | Échéancier mensuel (12 redevances) |
| **Séance à la carte** (1 collecte ponctuelle) | **2 500 FC** | Paiement unique, sans échéancier |
| Sacs poubelle (lot de 10) | 5 000 FC | Intrant géré en stock |
| Désinfectant (bidon 1 L) | 15 000 FC | Intrant géré en stock |

**Commissions TAKATA** : 20 % à la souscription (Standard 4 000 FC · Premium 7 000 FC · Séance **500 FC**), 5 % sur les renouvellements (1 000 FC sur une redevance Standard).

## 4. Navigation par rôle

- **Commercial** : Accueil · Clients · Prospects · Échéances · Profil — FAB « + » pour créer client/prospect/abonnement/encaissement.
- **Technicien** : Accueil (abonnements en service, tournées, matériel) · Tournées · Matériel · Profil.
- **Superviseurs & Direction** : Accueil · Supervision (overview scoped) · Équipes · Rapports · Profil.
- Le menu de bas de page et les accès s'adaptent **automatiquement au rôle connecté**.

## 5. Design « 11 Build »

- ≥ 70 % de blanc, coins nets (4 px), ombres très douces.
- Un seul accent : vert émeraude **#1B7A3D** (vert doux #F0F7F2 pour badges/fonds).
- Graisses 300 (corps) → 600 (titres) ; zéro dégradé, zéro orange hérité.
- `public/css/takata.css` — mêmes noms de classes que la v1 : **aucune vue cassée**.

## 6. Hors-ligne & multi-appareils

- File d'attente locale (`sync_queue`) + idempotence par UUID client ; les opérations créées hors-ligne sont rejouées à la reconnexion (`POST /api/sync`).
- Chaque action métier déclenche une notification ciblée (créateur, agent concerné, superviseur).

## 7. Tests & preuves

| Commande | Ce que ça prouve |
|---|---|
| `npm run test:audit` | Audit matriciel **159 contrôles** : 5 profils × 29 routes/options sur base vide |
| `npm run test:e2e` | **25 scénarios métier** : prospect→client→séance→encaissement (complet 500 FC), technicien, superviseurs, direction |
| `npm run test:roles` | **52 vérifications** : logins des 6 comptes, produits secteur, périmètres par rôle (agent1 vs agent2), refus 403 technicien, supervision scoped, non-élévation à la création, adminGEN tout voir + création de comptes, création/persistance client, commission séance 500 FC |
| `npm run test:persist` | Client « Repère Persistance » créé puis retrouvé **après redémarrage du serveur** (persistance SQLite) |
| `npm run test:smoke` | 44 contrôles de bout en bout (auth, ACL, CRUD, sync, PWA…) |
| `npm run test:security` | Campagne sécurité (81 contrôles : IDOR, SQLi, XSS, rate-limit, révocation) |
| `npm run test:render` | Rendu PWA réel (Chrome headless) : login, dashboards, listes, rapports, zéro erreur JS |
| `npm run snap` | Captures d'écran par rôle (Edge headless CDP) dans `captures/` |
| `npm run audit` | Audit en direct : périmètres, manifest, artefacts résiduels |

## 8. Architecture (structure conservée)

```
server.js          Express (port 8080), sécurité headers, gestion d'erreurs
db.js              SQLite + schéma + migration rôles v2 (préserve les données)
auth.js            scrypt, tokens condensés SHA-256, middlewares & helpers de rôles
seed.js            Données de démonstration (comptes, produits, stock, abonnements, commissions)
routes/
  auth.js          login/logout/me/change-password/register-agent (création de comptes)
  agent.js         dashboard, clients, prospects, abonnements, paiements, échéances, commissions, notifications, stock
  admin.js         overview scoped, équipes, formules, stock admin, paiements de commissions
  reports.js       synthèse + exports CSV (réservés supervision)
  sync.js          file hors-ligne idempotente
public/            PWA (index.html, manifest, sw.js, css/takata.css, js/{api,views,admin,app}.js)
tests/             suites (voir §7)
data/takata.db     base SQLite
```

## 9. Notes de sécurité

- Mots de passe : scrypt (sel 16 o) ; tokens : condensé SHA-256, TTL 30 j, révocation totale au reset.
- Rate-limit de connexion : soft-lock IP 15 min après 5 échecs (les tests de sécurité déclenchent volontairement ce verrou ; un redémarrage du serveur le réinitialise).
- Exports CSV : réservés à la direction et aux superviseurs.
- Anti-injection : requêtes préparées partout ; échappement systématique côté rendu (`esc()`).
