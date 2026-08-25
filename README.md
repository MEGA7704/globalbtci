# GLOBAL BT — Cloudflare Pages + GitHub + KV + D1

Version consolidée, conçue pour éviter de publier les secrets dans GitHub.

## Cloudflare existant

- KV binding : `GLOBAL_BT_KV`
- KV namespace : `fa67ed41b2d14bf69fa7b0c0ee6bca8b`
- D1 binding : `DB`
- D1 database : `global_bt_d1`
- D1 ID : `6cff1413-f730-42e1-abcb-e64e34c6e06f`

## Sécurité incluse

- `POST /api/login` réel côté serveur.
- Mot de passe vérifié uniquement dans `public/_worker.js`.
- Les vrais hash/sel sont stockés dans `user_credentials`, jamais retournés par `/api/load`.
- Migration des anciens hash/sel de `users` vers `user_credentials`; les anciennes colonnes sont remplacées par `MIGRATED` lorsqu'elles existent.
- `/api/load` et `/api/save` exigent une session valide.
- Cookie `HttpOnly; Secure; SameSite=Lax`.
- CSRF obligatoire pour toutes les écritures authentifiées.
- rôles `superadmin`, `admin`, `agent` vérifiés côté serveur.
- isolation par `company_id` provenant uniquement de la session.
- plans/statuts d'entreprise modifiables uniquement par Super Admin.
- limitation 15 minutes par IP ET e-mail après 5 échecs.
- `password_version` invalide automatiquement les anciennes sessions après changement/réinitialisation/désactivation.
- journal des actions sensibles dans `audit_logs`.
- suppression logique des comptes et entreprises.
- demandes de mot de passe oublié.
- Administrateur réinitialisé par Super Admin.
- Agent réinitialisé par l'Administrateur de son entreprise.

## Plans

- Free : accès complet 21 jours.
- Business : accès complet 365 jours.
- Le popup Free s'affiche à l'ouverture de chaque section et au moins toutes les 15 minutes.
- Paiement Business :
  `https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=20600`
- Ouvrir le lien ne change pas automatiquement le plan. Le Super Admin active Business.

## Super Admin — secret hors GitHub

Le dépôt NE CONTIENT PAS le mot de passe initial.

Configurer dans Cloudflare Pages les secrets suivants :

```bash
npx wrangler pages secret put SUPERADMIN_EMAIL --project-name global-bt
npx wrangler pages secret put SUPERADMIN_INITIAL_PASSWORD --project-name global-bt
npx wrangler pages secret put SESSION_PEPPER --project-name global-bt
```

Pour `SUPERADMIN_EMAIL`, utiliser l'adresse Super Admin prévue.
Pour `SUPERADMIN_INITIAL_PASSWORD`, saisir le mot de passe initial directement au prompt Wrangler.
Pour `SESSION_PEPPER`, saisir une longue valeur aléatoire (32 caractères ou plus).

## Build Cloudflare Pages exact

- Framework preset : `None`
- Production branch : `main`
- Root directory : `/`
- Build command / Commande de version : `npm run build`
- Build output directory / Répertoire de sortie : `dist`

## Déploiement

```bash
npm install
npm run check
npx wrangler d1 migrations apply global_bt_d1 --remote
npm run build
```

Puis pousser sur GitHub.

Après ajout des secrets, redéployer le projet Pages.

## Diagnostic

`GET /api/health`

Le résultat attendu après configuration :

```json
{
  "ok": true,
  "d1_bound": true,
  "kv_bound": true,
  "superadmin_email_configured": true,
  "superadmin_password_configured": true,
  "session_pepper_configured": true,
  "schema_ready": true
}
```

Au premier chargement, `POST /api/bootstrap` crée ou répare le Super Admin si aucun Super Admin n'existe encore.


## V11 — Bootstrap stable
Le Super Admin est créé/réparé avant la migration non bloquante des anciens identifiants. `/api/health` affiche `app_version`, `superadmin_ready` et `superadmin_credential_ready`.


## V12 — Authentification V2 indépendante

Pour éliminer définitivement les conflits avec les anciennes tables de credentials,
GLOBAL BT utilise maintenant `auth_credentials_v2`.

- le profil utilisateur reste dans `users`;
- le vrai hash/sel est stocké dans `auth_credentials_v2`;
- l'ancienne table `user_credentials` n'est plus requise pour créer le Super Admin;
- si un ancien credential valide existe, il peut être recopié vers V2 à la première connexion;
- les nouveaux comptes, changements et réinitialisations utilisent exclusivement V2;
- `/api/health` vérifie le credential Super Admin dans V2.


## V13 — Correction mot de passe initial Super Admin

Le mot de passe initial configuré dans le secret Cloudflare peut avoir entre 8 et 11 caractères.
Cette exception ne concerne que le bootstrap Super Admin.

Les règles normales restent inchangées :
- inscription Administrateur : 12 caractères minimum ;
- création Agent : 12 caractères minimum ;
- réinitialisation : 12 caractères minimum ;
- changement de mot de passe : 12 caractères minimum.

Le mot de passe initial n'est jamais écrit dans GitHub, HTML ou JavaScript navigateur.


## V14 — Authentification Super Admin par secret Cloudflare

Le Super Admin n'a plus besoin d'un hash/sel dans D1.

Lors de `POST /api/login` :
- l'e-mail est comparé à `SUPERADMIN_EMAIL`;
- le mot de passe est comparé de manière sécurisée à `SUPERADMIN_INITIAL_PASSWORD`;
- toute la vérification reste exclusivement dans `_worker.js`;
- aucune valeur secrète n'est envoyée au navigateur;
- KV conserve le rate-limit et la session;
- D1 conserve uniquement le profil/role du Super Admin et le journal d'audit.

Administrateurs et Agents continuent d'utiliser `auth_credentials_v2` dans D1.

Pour changer le mot de passe Super Admin, remplacer le secret Cloudflare
`SUPERADMIN_INITIAL_PASSWORD`, puis redéployer. Cela évite toute dépendance aux
anciennes tables d'authentification.
