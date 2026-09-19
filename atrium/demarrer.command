#!/usr/bin/env bash
# Lanceur d'Atrium — macOS et Linux.
# Double-cliquez sur ce fichier. Il installe ce qu'il faut à la première
# utilisation, démarre l'application et ouvre votre navigateur.
set -euo pipefail

cd "$(dirname "$0")"

printf '\n  Atrium\n\n'

if ! command -v node >/dev/null 2>&1; then
  printf '  Node.js est requis et ne semble pas installé.\n'
  printf '  Installez-le depuis https://nodejs.org (version 20 ou plus), puis relancez ce fichier.\n\n'
  read -r -p '  Appuyez sur Entrée pour fermer.' _
  exit 1
fi

version=$(node -p 'process.versions.node.split(".")[0]')
if [ "$version" -lt 20 ]; then
  printf '  Node.js %s est trop ancien : il faut la version 20 ou plus.\n' "$(node -v)"
  printf '  Mettez-le à jour depuis https://nodejs.org, puis relancez ce fichier.\n\n'
  read -r -p '  Appuyez sur Entrée pour fermer.' _
  exit 1
fi

if [ ! -d node_modules ]; then
  printf '  Première utilisation : installation en cours (une à deux minutes)…\n\n'
  npm install --no-audit --no-fund
  printf '\n'
fi

printf '  Démarrage…\n'

# Le navigateur s'ouvre dès que le serveur répond, pas avant.
(
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null http://localhost:3000/; then
      if command -v open >/dev/null 2>&1; then open http://localhost:3000
      elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
      fi
      break
    fi
    sleep 1
  done
) &

printf '  Adresse : http://localhost:3000\n'
printf '  Pour arrêter : fermez cette fenêtre, ou Ctrl+C.\n\n'

npm run dev
