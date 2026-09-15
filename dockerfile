# Takata Kwetu — image Docker de production (Node + better-sqlite3 + PWA)
# Le disque persistant doit être monté sur /data (TAKATA_DB=/data/takata.db)
FROM node:22-bookworm-slim

# better-sqlite3 : compilation native si aucun prebuild ne correspond
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances d'exécution uniquement (pas de devDeps : puppeteer/sharp/docx inutiles en prod)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Code applicatif
COPY . .

# Dossier de données persistant + entrée
ENV NODE_ENV=production \
    PORT=8080 \
    TAKATA_DATA_DIR=/data \
    TAKATA_DB=/data/takata.db \
    TRUST_PROXY=1
RUN mkdir -p /data/backups && chmod +x docker-entrypoint.sh || true
EXPOSE 8080

# Santé (pas de curl dans slim : on utilise node)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
