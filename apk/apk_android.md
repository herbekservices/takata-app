# TAKATA sur Android — 3 voies d'installation (PWA, APK Capacitor, TWA)

L'application TAKATA est une **PWA** : le navigateur Android (Chrome) l'installe déjà comme une vraie application plein écran. Pour un **vrai APK** distribuable à chaque membre, deux voies techniques existent. Dans tous les cas, **l'application téléphone se connecte au serveur TAKATA** (Node/Express + SQLite) qui doit être démarré et joignable depuis le réseau du téléphone.

---

## Voie A — PWA installable (immédiate, aucun outil requis) ✅ recommandée pour démarrer

1. Démarrez le serveur sur le PC : `npm start` (http://localhost:8080 — il écoute sur toutes les interfaces réseau).
2. Sur le téléphone Android, connectez-vous au **même Wi-Fi** que le PC et ouvrez Chrome à l'adresse : `http://<IP-du-PC>:8080`
   (trouvez l'IP du PC avec `ipconfig` → adresse IPv4, ex. `http://192.168.1.10:8080`).
3. Menu Chrome ⋮ → **« Ajouter à l'écran d'accueil »** → l'icône TAKATA s'installe et s'ouvre en plein écran (comme une app native, avec son service worker hors-ligne).

✅ Aucun APK, mise à jour automatique (le SW versionné `takata-v5` détecte les mises à jour).
⚠️ Fonctionne sur le même réseau Wi-Fi que le serveur (pré-production).

---

## Voie B — APK via Capacitor (projet prêt dans `apk/`)

Le dossier `apk/` contient le client Android Capacitor : l'APK ouvre directement l'URL du serveur TAKATA.

### Prérequis
1. **Java 17** ✅ (déjà installé : Eclipse Adoptium JRE 17).
2. **Android Studio** (installe le SDK Android 34 + build-tools) — https://developer.android.com/studio
   → définir la variable d'environnement `ANDROID_HOME = C:\Users\<vous>\AppData\Local\Android\Sdk`.
3. Node.js 22 ✅ (déjà installé).

### Étapes de build
```bash
cd apk
npm install                      # installe @capacitor/core, cli, android
npx cap add android              # génère le projet natif android/
npx cap sync android             # copie www/ + configuration
cd android
gradlew.bat assembleDebug        # produit app-debug.apk (signé automatiquement)
```
→ L'APK : `android\app\build\outputs\apk\debug\app-debug.apk` — installable sur n'importe quel Android 7+ (paramètres → autoriser les sources inconnues).

### Configuration de l'URL du serveur (à faire AVANT le build)
Éditez `apk\capacitor.config.json` :
```json
"server": { "url": "http://<IP-ou-domaine-du-serveur>:8080", "cleartext": true }
```
- En LAN : l'IP du PC serveur (ex. `http://192.168.1.10:8080`).
- En ligne : l'URL de votre hébergement (ex. `https://api.takata.cd`) — retirez alors `"cleartext": true`.

### Signature release (pour une distribution propre)
```bash
gradlew.bat assembleRelease       # nécessite une clé de signature (keystore)
```
Créez un keystore une fois : `keytool -genkey -v -keystore takata.keystore -alias takata -keyalg RSA -keysize 2048 -validity 10000`

---

## Voie C — TWA via Bubblewrap (APK Play Store, serveur HTTPS requis)

Quand le serveur sera hébergé en HTTPS avec un domaine, l'APK peut être généré en une commande :
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://votre-domaine/manifest.json
bubblewrap build
```
⚠️ Nécessite : serveur en HTTPS, PWA conforme (manifest ✓ + service worker ✓) et un fichier `assetlinks.json` sur le serveur.

---

## Résumé des contraintes

| Voie | Effort | Backend | Distribution |
|---|---|---|---|
| A. PWA | ✅ immédiat | LAN/HTTPS (même Wi-Fi) | « Ajouter à l'écran d'accueil » |
| B. APK Capacitor | Android Studio requis | URL configurable (LAN ou HTTPS) | fichier APK à partager |
| C. TWA Bubblewrap | HTTPS public obligatoire | hébergé | Play Store / APK |

> Point d'architecture : l'application est client-serveur (l'API + la base SQLite restent sur le serveur). Un APK n'embarque PAS les données : il se connecte au serveur. Pour une autonomie complète hors-ligne par téléphone, la migration Supabase/Firebase (déjà prévue) sera la suite logique.
