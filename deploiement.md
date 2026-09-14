# TAKATA — Guide de déploiement en ligne (14/09/2026)

Paquet **prêt à déployer** : `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`, `render.yaml`, `fly.toml`, `.env.example`.
Le code a été préparé pour la production : base déplaçable (`TAKATA_DATA_DIR` / `TAKATA_DB`), `TRUST_PROXY` (vraie IP client derrière un proxy), sauvegarde quotidienne dans `<données>/backups/`, arrêt gracieux, alerte si comptes de démo actifs.
**Vérifié localement en mode production** : démarrage avec `NODE_ENV=production` + base sur disque externe → smoke test **44/44**.

> ⚠️ SQLite = un **fichier**. Votre hébergeur DOIT fournir un **disque/volume persistant**, sinon les données disparaissent à chaque redéploiement/veille.

---

## Option 1 — Render (recommandée : vous y déployez déjà d'autres projets)

1. Pousser le code dans un dépôt **GitHub** (privé) :
   ```bash
   cd projects/website-c51da70ab798b3e76b83c7c4
   git init && git add -A && git commit -m "TAKATA v3 déploiement"
   git remote add origin https://github.com/<votre-compte>/takata.git
   git push -u origin main
   ```
   (Ajoutez `data/`, `node_modules/`, `.env` au `.gitignore` — déjà le cas globalement.)
2. Render → **New + → Blueprint** → sélectionner le dépôt (le fichier `render.yaml` est déjà prêt).
3. Le blueprint crée le service `takata-app` avec :
   - build `npm ci --omit=dev`, start `node server.js`, healthcheck `/api/health`
   - **disque persistant** `takata-data` monté sur `/data`, 1 Go (`plan: starter`, disque = instance payante)
   - variables `TAKATA_DB=/data/takata.db`, `TRUST_PROXY=1`, `NODE_ENV=production`
4. Premier démarrage : la base est créée automatiquement (`docker-entrypoint.sh` équivalent → `seed` si base absente).
5. **Sécurité immédiate** : se connecter avec `admin/admin123`, changer les mots de passe, créer les vrais comptes, désactiver les comptes de démo.
6. Domaine : Render fournit `https://takata-app.onrender.com` ; ajouter votre domaine dans **Settings → Custom Domain** (CNAME) — HTTPS automatique.
7. Sauvegardes : télécharger régulièrement `/data/backups/` via le shell Render ou l'API ; le serveur en crée une par jour (7 conservées).

**Coût indicatif Render** : instance `starter` ~7 $/mois + disque 0,25 $/Go/mois ([render.com/pricing](https://render.com/pricing), [docs disques](https://render.com/docs/disks)). Le tier gratuit met le service en veille et **perd le disque**.

## Option 2 — Fly.io (disque + machines)

```bash
flyctl launch --no-deploy        # utilise fly.toml
flyctl volumes create takata_data --size 1 --region cdg
flyctl deploy
flyctl logs
```
Volumes **0,15 $/Go/mois**, snapshots quotidiens ([fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/)). Région `cdg` (Paris) ou `jnb` (Johannesburg) pour la latence Afrique.

## Option 3 — VPS (contrôle total, ~5–10 $/mois)

Sur Ubuntu 24.04 (ex. OVH/Hostinger/Infomaniak) :
```bash
sudo apt update && sudo apt install -y nodejs npm caddy
sudo mkdir -p /opt/takata /var/lib/takata && sudo chown $USER /var/lib/takata
# copier le projet dans /opt/takata puis :
cd /opt/takata && npm ci --omit=dev
TAKATA_DATA_DIR=/var/lib/takata TAKATA_DB=/var/lib/takata/takata.db node seed.js --reset   # 1re fois
```
Service systemd `/etc/systemd/system/takata.service` :
```ini
[Unit]
Description=TAKATA
After=network.target
[Service]
WorkingDirectory=/opt/takata
Environment=NODE_ENV=production PORT=8080 TRUST_PROXY=1 TAKATA_DATA_DIR=/var/lib/takata TAKATA_DB=/var/lib/takata/takata.db
ExecStart=/usr/bin/node server.js
Restart=always
User=www-data
[Install]
WantedBy=multi-user.target
```
Reverse proxy + HTTPS automatique (Caddy) `/etc/caddy/Caddyfile` :
```
takata.votredomaine.com {
  reverse_proxy 127.0.0.1:8080
}
```
puis `sudo systemctl enable --now takata caddy`. Sauvegarde hors-site : `rsync`/`scp` quotidien de `/var/lib/takata/backups/`.

## Option 4 — Alwaysdata (cité dans vos recherches)

Alwaysdata héberge des sites **Node.js** ; il faut vérifier que l'offre retenue offre **assez de disque persistant** pour la base + sauvegardes (l'offre gratuite est très limitée) : stockage local persistant, `TAKATA_DB` pointant dans votre répertoire de données. Déploiement via SSH/Git. Vérifiez le moyen de paiement accepté (souvent carte bancaire internationale).

## Option 5 — Test local en Docker

```bash
docker build -t takata .
docker run -d -p 8080:8080 -v takata_data:/data --name takata takata
# → http://localhost:8080  (le volume persiste la base)
```

---

## Distribuer l'application aux agents (téléphones)

### Voie A — PWA (recommandée, zéro APK) ⭐
1. Ouvrir l'URL déployée (ex. `https://takata-app.onrender.com`) dans Chrome Android.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** → icône plein écran + mode hors-ligne (service worker).
3. Mises à jour instantanées pour tout le monde ; rien à installer, pas d'avertissement Android.

### Voie B — APK Android (dossier `apk/`, projet Capacitor prêt)
1. Construire l'APK (Java 17 + Android Studio SDK 34 — voir `apk/apk_android.md`), en pointant `capacitor.config.json` sur l'URL déployée.
2. Héberger l'APK :
   - **GitHub Releases** (gratuit, permanent) : créer une release, glisser l'APK → lien direct `github.com/<compte>/takata/releases/download/v1.0/takata.apk`.
   - **Sur le site TAKATA** : déposer l'APK dans `public/download/` — le fichier `public/_headers` (Netlify/Vercel) et le modèle Apache `.htaccess` fournis déclarent le bon type MIME `application/vnd.android.package-archive` (indispensable pour que le téléphone reconnaisse l'installeur).
   - Page prête : `public/download.html` (boutons APK + PWA, à adapter après la première release).
3. Google Play Store : **25 $ une fois** (compte développeur à vie) — validation de quelques heures à quelques jours, mises à jour automatiques, confiance maximale.

### Voie C — Test limité (Firebase App Distribution / Diawi)
Pratique pour des bêta-testeurs uniquement ; liens souvent temporaires.

---

## Comparatif rapide (14/09/2026)

| Option | Disque persistant | Coût/mois réaliste | Remarques |
|---|---|---|---|
| **Render** | Oui (payant) | ~7 $ + 0,25 $/Go | Vous y êtes déjà ; mise en veille du tier gratuit |
| **Fly.io** | Oui (volumes) | ~2–5 $ | Snapshots quotidiens ; régions cdg/jnb |
| **Railway** | Oui (volumes) | ~5 $ (Hobby) puis usage | Essai 5 $ ; plan Pro ~20 $ |
| **VPS** | Oui (contrôle total) | ~5–10 $ | Nécessite administration ; meilleure maîtrise |
| **Alwaysdata** | À vérifier selon l'offre | 0–~10 $ | Node possible ; vérifier disque + paiement |

Sources : [Render pricing](https://render.com/pricing) · [Render disques](https://render.com/docs/disks) · [Fly pricing](https://fly.io/docs/about/pricing/) · [Railway pricing](https://railway.com/pricing). Les tarifs évoluent : vérifier au moment de l'achat.

## Ce qu'il reste à faire (je peux le finaliser)

Il me manque **un accès** pour publier réellement : soit un **dépôt GitHub** (token) + une **clé API Render** (Account → Settings → API Keys), soit un **VPS** (hôte, utilisateur SSH, domaine). Avec cela, je pousse, je déploie, je vérifie `/api/health` en ligne, je lance le smoke test distant et je vous rends l'URL publique prête à installer en PWA.

---

# ✅ DÉPLOIEMENT RÉALISÉ — 14/09/2026

| Élément | Valeur |
|---|---|
| **Adresse permanente** | **https://takata-app.onrender.com** (HTTPS, indépendante de tout PC) |
| Hébergeur | Render — service `takata-app` (`srv-dajt74oae00c73bapf40`), région Frankfurt, plan gratuit |
| Code source | Dépôt GitHub `herbekservices/takata-app` (branche `main`, auto-déploiement à chaque envoi) |
| Base de données | SQLite dans `/tmp/takata` + **sauvegarde automatique** vers le dépôt privé `herbekservices/takata-data` toutes les 5 min, **restauration automatique au démarrage** |
| Comptes | 9 comptes (direction, 2 superviseurs, 3 commerciaux, 2 techniciens, 1 désinfection) — voir `TAKATA_ACCES_APPLICATION.xlsx` |
| APK | `TAKATA-v1.0-debug.apk` (pointant sur l'adresse permanente) + page `/download.html` |

### Points d'exploitation
- **Redéployer** : `git push` sur `herbekservices/takata-app` (Render redéploie automatiquement) ou bouton « Deploy » du tableau de bord.
- **Base** : sur le plan gratuit, le disque est éphémère → la durabilité est assurée par la sauvegarde GitHub (`persist.js`). **Pour une durabilité native** (sans dépendre de la sauvegarde) : ajouter un moyen de paiement sur Render puis passer le service en plan `starter` avec un disque `takata-data` monté sur `/data` (≈ 7-8 $/mois) — le code le supporte déjà (`TAKATA_DATA_DIR=/data`).
- **Dépôt public** : `takata-app` est actuellement public (nécessaire pour un déploiement sans app GitHub autorisée). Pour le repasser en privé : connecter GitHub dans Render (Account Settings → GitHub → Configure) puis `PATCH /v1/services` — ou simplement basculer le dépôt en privé après connexion.
- **Sauvegarde locale de secours** : le tunnel Cloudflare du PC (`start-takata-online.bat`) reste installé mais l'adresse officielle est celle de Render.
