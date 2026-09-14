#!/bin/sh
# TAKATA — entrée Docker : initialise la base au premier démarrage puis lance le serveur
set -e

DB="${TAKATA_DB:-/data/takata.db}"
if [ ! -f "$DB" ]; then
  echo "🆕 Première initialisation : création de la base ($DB)"
  node seed.js --reset || {
    echo "❌ Échec du seed initial — arrêt pour éviter une base vide." >&2
    exit 1
  }
else
  echo "♻️  Base existante détectée ($DB)"
fi

exec node server.js
