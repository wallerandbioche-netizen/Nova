# Déployer SCAN TRADE

La démonstration statique (`demo/`) n'embarque que l'interface et le moteur d'analyse.
Le site complet, lui, a besoin d'un hébergeur Node : c'est là que vit
`POST /api/analyze/screenshot`, la seule route capable de **lire réellement une capture**,
et c'est elle qui garde la clé d'API hors du navigateur.

|                                | Démonstration statique | Site complet                |
| ------------------------------ | ---------------------- | --------------------------- |
| Interface, journal, abonnement | oui                    | oui                         |
| Moteur d'analyse               | oui                    | oui                         |
| Lecture de la capture déposée  | non — refus explicite  | oui, avec une clé d'API     |
| Hébergement                    | fichiers statiques     | Node (Vercel, Render, VPS…) |

## Vercel, en cinq étapes

1. Ouvrez <https://vercel.com/new> et importez `wallerandbioche-netizen/Nova`.
2. **Root Directory** : `apps/web`. Vercel détecte Next.js tout seul.
3. **Install Command** (à remplacer, sinon l'installation tire aussi l'application mobile) :

   ```
   pnpm install --filter @scantrade/web...
   ```

4. **Environment Variables** : ajoutez `ANTHROPIC_API_KEY` avec votre clé
   (<https://console.anthropic.com> → API keys). Facultatif : `SCANTRADE_MODEL`.
5. **Production Branch** : dans _Settings → Git_, choisissez la branche qui porte
   l'application (`claude/wonderful-cerf-ueom80`) tant qu'elle n'est pas fusionnée.

Le déploiement donne une URL du type `https://scan-trade.vercel.app`, et chaque push sur
la branche en redéploie une nouvelle version.

## Sans clé d'API

Le site se déploie et fonctionne quand même : l'interface, le journal, l'abonnement et le
moteur sont là. Seule la lecture d'image manque, et l'application le dit — « Données
visuelles insuffisantes pour une analyse fiable » — puis propose une analyse de
démonstration étiquetée comme telle. Rien n'est inventé pour combler le vide.

## En local

```bash
pnpm install --filter @scantrade/web...
echo "ANTHROPIC_API_KEY=sk-ant-..." > apps/web/.env.local
pnpm dev:web      # http://localhost:3100
```

C'est exactement le site complet, routes d'API comprises. Pour y accéder depuis un
téléphone sur le même réseau :

```bash
pnpm --filter @scantrade/web exec next dev --port 3100 --hostname 0.0.0.0
```

## Coût de la lecture d'image

Chaque analyse de capture envoie une image au modèle de vision, donc consomme des jetons
sur votre compte. Le reste — structure, niveaux, confluence, plan, risque — est calculé
localement et ne coûte rien.
