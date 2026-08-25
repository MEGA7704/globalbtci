# GLOBAL BT — Version complète Cloudflare Pages / GitHub / D1 / KV

## Ressources imposées

- KV : `GLOBAL_BT_KV`
- KV namespace ID : `fa67ed41b2d14bf69fa7b0c0ee6bca8b`
- D1 : `global_bt_d1`
- D1 database ID : `6cff1413-f730-42e1-abcb-e64e34c6e06f`
- Binding D1 dans le Worker : `DB`

## Fonctionnalités incluses  

- Authentification serveur `POST /api/login`
- PBKDF2-SHA-256 exclusivement dans `public/_worker.js`
- cookies HttpOnly + Secure + SameSite=Lax
- sessions KV
- CSRF obligatoire pour les écritures
- rate limit IP + compte pendant 15 minutes
- invalidation des sessions par `password_version`
- multi-entreprises strict par `company_id`
- Super Admin
- création / activation / désactivation / suppression logique des entreprises et membres
- Free 21 jours / Business 365 jours
- popup commercial Free à l'ouverture et toutes les 15 minutes
- demandes de mot de passe oublié
- Admin réinitialisé par Super Admin
- Agent réinitialisé par son Administrateur
- journal D1 des actions sensibles
- projets, corps de métier, fournisseurs, dépenses, main-d'œuvre
- tableaux de bord et rapports
- import réel de `bt.xlsx` via SheetJS/XLSX
- impression / export PDF via impression navigateur
- interface responsive avec menu horizontal sticky

## Secrets — NE PAS METTRE DANS GITHUB

Le dépôt ne contient pas le mot de passe Super Admin.

Après création du projet Pages, configurer :

```bash
npx wrangler pages secret put SUPERADMIN_EMAIL --project-name global-bt
npx wrangler pages secret put SUPERADMIN_INITIAL_PASSWORD --project-name global-bt
npx wrangler pages secret put SESSION_PEPPER --project-name global-bt
```

Saisir les valeurs directement dans le terminal au prompt sécurisé.

## Installer et tester

```bash
npm install
npm run check
npm run build
```

## Appliquer D1

```bash
npx wrangler d1 migrations apply global_bt_d1 --remote
```

## Cloudflare Pages — Build exact

- Framework preset : **None**
- Production branch : **main**
- Root directory : **/**
- Build command : **npm run build**
- Build output directory : **dist**

## Premier démarrage

1. Appliquer les migrations.
2. Configurer les trois secrets.
3. Redéployer Pages.
4. Ouvrir le site. Le navigateur appelle `/api/bootstrap`.
5. Le bootstrap crée le Super Admin uniquement si aucun Super Admin n'existe déjà.
6. Le mot de passe n'est jamais écrit en clair dans D1, GitHub, HTML ou JavaScript client.
7. Après connexion avec un mot de passe temporaire d'un membre, GLOBAL BT peut exiger son remplacement.

## Développement local

Créer un fichier `.dev.vars` non versionné avec :

```text
SUPERADMIN_EMAIL=...
SUPERADMIN_INITIAL_PASSWORD=...
SESSION_PEPPER=...
```

Puis :

```bash
npm install
npm run db:migrate:local
npm run dev
```

## Important

Le paiement Wave ouvre seulement la page de paiement. Il n'active pas automatiquement Business. Le changement de plan reste une action Super Admin tant qu'un webhook de paiement vérifié n'est pas ajouté.
