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

- Free : accès complet 10 jours (0 FCFA).
- Standard : accès complet 30 jours (2 100 FCFA).
- Business : accès complet 365 jours (20 600 FCFA).
- Le popup Free s'affiche à l'ouverture de chaque section et toutes les 15 minutes.
- Paiement Standard :
  `https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=2100`
- Paiement Business :
  `https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=20600`
- Le bouton « Activer mon abonnement » ouvre un popup de paiement et de transmission au support.
- Après paiement, l’Administrateur transmet le numéro utilisé et l’ID de transaction.
- La demande apparaît dans **Super Admin > Abonnements**, où elle peut être activée ou rejetée.
- Un plan Standard ou Business encore actif bloque toute nouvelle demande et tout nouveau bouton de paiement.
- Une demande en attente bloque également toute nouvelle transmission/paiement dans l’interface.

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


## V15 — Correction inscription Administrateur

- compatibilité automatique avec les anciennes tables `companies`;
- ajout sécurisé des colonnes `city`, `code`, `phone`, `email`, `address` si absentes;
- insertion entreprise dynamique selon le schéma D1 réellement présent;
- création Administrateur puis credential V2;
- nettoyage automatique si une étape échoue;
- le message d'erreur indique désormais l'étape (`company_insert`, `user_insert`, `credential_insert`, etc.) et un code non sensible;
- `/api/health` retourne `company_schema_ready`.


## V16 — Authentification membres V3

L'inscription Administrateur échouait à `credential_insert` car l'ancienne table
`auth_credentials_v2` du D1 était incompatible.

Correction :
- nouvelle table `member_credentials_v3`;
- nouveaux Administrateurs et Agents écrivent uniquement dans V3;
- connexion Administrateur/Agent lit V3;
- réinitialisations et changements de mot de passe utilisent V3;
- migration non bloquante depuis `auth_credentials_v2` ou `user_credentials`;
- le Super Admin reste authentifié directement via le secret Cloudflare.


## V17 — Réparation fonctionnelle générale

Cette version met automatiquement à niveau toutes les tables métier existantes :
`projects`, `trades`, `suppliers`, `expenses`, `labor_expenses`,
`password_reset_requests`, `audit_logs`, `companies` et `users`.

Le Super Admin et les Administrateurs voient aussi si chaque membre possède un
credential V3 utilisable :
- Accès prêt
- Mot de passe à réinitialiser

Une réinitialisation de mot de passe crée/répare automatiquement le credential
dans `member_credentials_v3`.

`/api/save` renvoie désormais le module, l'action et un code d'erreur précis au
lieu d'un simple "Erreur serveur".


## V18 — Authentification Administrateurs/Agents dans KV

Correction définitive de `credential_insert`.

- D1 garde les profils, entreprises, rôles, projets, dépenses et journaux.
- `GLOBAL_BT_KV` garde les credentials serveur sous `cred:v1:<user_id>`.
- Le navigateur ne reçoit jamais le hash, le sel ou le credential.
- `POST /api/login` vérifie toujours le mot de passe uniquement dans `_worker.js`.
- Les réinitialisations et changements de mot de passe mettent à jour KV.
- `password_version` dans D1 invalide toujours les sessions après changement.
- Les anciens credentials D1 sont migrés vers KV automatiquement s'ils existent.

Cette version ne dépend plus des tables `user_credentials`, `auth_credentials_v2`
ou `member_credentials_v3` pour créer un nouvel Administrateur.


## V19 — Correction Cloudflare `outcome: canceled`

La réparation complète du schéma D1 n'est plus exécutée dans `/api/register`,
`/api/load` ni `/api/save`.

Elle est exécutée au bootstrap puis mémorisée dans KV sous
`schema:global-bt:v19`.

L'inscription prépare aussi le hash du mot de passe avant les écritures D1,
puis stocke le credential membre dans KV.


## V20 — Correction PBKDF2 à l'inscription

L'échec `credential_prepare` se produit avant toute écriture D1/KV.

Correction :
- nouveaux credentials : PBKDF2-SHA-256 à 100 000 itérations ;
- anciens credentials : leur valeur `password_iterations` reste respectée à la connexion ;
- nouvelle route `/api/crypto-health` pour tester uniquement le moteur cryptographique ;
- code d'erreur explicite `PASSWORD_HASH_FAILED`.

Après déploiement, ouvrir `/api/crypto-health`.
Le résultat attendu est `ok: true`.


## V21 — Main-d'œuvre + CSRF

- insertion `labor_expenses` adaptée au schéma D1 existant ;
- compatibilité avec `description` / `work_description` et `reference` / `payment_reference` ;
- diagnostic explicite `LABOR_REQUIRED_COLUMNS:<colonne>` si une vieille colonne obligatoire subsiste ;
- nouvelle route `/api/csrf` ;
- renouvellement automatique du jeton CSRF puis nouvelle tentative unique de l'écriture.


## V22 — Tableau de bord professionnel dynamique

Nouveau tableau de bord :
- cartes de performance dynamiques ;
- projets totaux / en cours / terminés ;
- budget global ;
- dépenses totales ;
- budget restant ;
- dépenses du mois ;
- poids de la main-d'œuvre ;
- jauge de consommation budgétaire ;
- comparaison matériaux / main-d'œuvre ;
- évolution des dépenses sur les 6 derniers mois ;
- classement des dépenses par métier ;
- tableau de performance budgétaire de chaque projet ;
- alertes de dépassement et projets suspendus ;
- impression / PDF.


## V23 — Correction doublon Corps de métier

La création d'un corps de métier vérifie maintenant l'existence du même nom
dans le même projet avant l'insertion.

En cas de doublon :
- HTTP 409 ;
- message : `Ce métier existe déjà pour ce projet` ;
- code : `TRADE_ALREADY_EXISTS`.

La comparaison ignore les différences de majuscules/minuscules et les espaces
en début/fin de nom.


## V24 — Anti double-clic + affichage des mots de passe

- protection globale des boutons d'action contre les doubles clics ;
- désactivation temporaire des boutons pendant une opération ;
- indicateur de chargement sur les boutons de soumission ;
- protection des formulaires contre les doubles soumissions ;
- bouton Voir / Masquer ajouté automatiquement à tous les champs `type=password`,
  y compris ceux créés dynamiquement dans les popups ;
- connexion, inscription, création d'Agent, création d'entreprise,
  réinitialisation et changement de mot de passe couverts.


## V25 — Bibliothèque professionnelle des corps de métier

- 62 métiers BTP disponibles par défaut ;
- recherche instantanée ;
- sélection multiple lors de la création d'un projet ;
- ajout de métiers personnalisés ;
- création automatique des métiers sélectionnés après création du projet ;
- compteur de métiers par projet ;
- page Corps de métier avec bibliothèque rapide et saisie personnalisée ;
- les métiers restent disponibles dans dépenses, main-d'œuvre, rapports et tableau de bord.


## V26 — Métiers hiérarchiques, lignes modifiables et PDF A4
11 phases principales du chantier, sous-corps sélectionnables, métiers personnalisés, modification par clic sur ligne, impression A4 des projets et métiers.


## V27 — Projets centralisés
Menu membre simplifié et opérations métiers/dépenses/fournisseurs/main-d’œuvre regroupées dans chaque projet. Modification, verrouillage/déverrouillage et suppression sont protégés par le mot de passe Administrateur côté serveur.


## V29 — Popup projet premium

Refonte visuelle du popup projet :
- en-tête ESPACE PROJET + fermeture circulaire ;
- bannière projet vert pétrole ;
- cartes KPI Budget / Dépenses / Main-d'œuvre ;
- onglets Métiers / Dépenses / Fournisseurs ;
- tableau professionnel avec actions Voir / Modifier / Supprimer pour les métiers ;
- pied de popup avec compteur, date de mise à jour, Imprimer et Fermer ;
- impression adaptée au format A4.


## V30 — Popup projet responsive sans défilement global sur grand écran

- le popup s'adapte automatiquement à la hauteur et largeur de l'écran ;
- sur grand écran, aucun défilement global du popup ;
- seules les zones de tableau peuvent défiler si la liste est longue ;
- en-tête, bannière KPI, onglets et pied restent visibles ;
- affichage encore plus compact sur écrans larges mais peu hauts ;
- tablette et mobile conservent un comportement responsive avec défilement adapté.


## V40 — Compte entreprise et demandes d’activation

- Paramètres : bouton **Mon compte** avec informations entreprise/Administrateur modifiables par l’Administrateur.
- Abonnement : popup professionnel Standard/Business avec lien Wave, téléphone de paiement et ID de transaction.
- Bouton **Envoyer au support** : enregistrement immédiat dans la section Abonnements du Super Admin.
- Super Admin : actions **Activer** / **Rejeter** avec note support.
- Activation validée : recalcul automatique de la date de début et d’expiration selon la formule.
- Protection anti-double demande et anti-réutilisation d’un ID de transaction.


## V41 — Numérotation des projets et impressions corporate

- Chaque nouveau projet reçoit automatiquement un numéro au format `PRJ-AAAA-001`.
- Les anciens projets sans numéro sont numérotés automatiquement au premier démarrage V41.
- La liste des projets affiche : N° projet, nom, type, localité, maître d’ouvrage, responsable, dates, statut et actions.
- Recherche des projets par statut, nom ou N° projet.
- Les actions de la liste des projets sont centrées.
- Nouveau modèle d’impression A4 commun, en portrait ou paysage selon le document.
- Entête alimentée par le compte de l’entreprise : nom, slogan, téléphone, e-mail, adresse, compte contribuable, RCCM et capital.
- Pied de page corporate avec total du document et pagination.
- Les fiches liées à un projet reprennent automatiquement le nom et le code du projet.
- Dans Paramètres > Mon compte : ajout de Slogan, Compte contribuable, RCCM et Capital social.


## V41.1 — Fiches imprimées premium selon le modèle de référence

- Refonte du gabarit commun `printA4()` sans toucher aux données ni aux règles métier.
- Entête en trois zones : identité entreprise, coordonnées, informations légales.
- Logo BTP vectoriel intégré au document (aucun fichier image externe requis).
- Titre central avec séparateurs et accents dorés.
- Bandeau supérieur : date d’édition, imprimé par, portefeuille/contexte et total.
- Bloc de synthèse : entreprise ou projet, période/code projet et statut.
- Tableaux à entête vert foncé, bordures fines et alignement renforcé.
- Statuts de projets présentés sous forme de pastilles dans les impressions concernées.
- Zone de signatures Préparé par / Approuvé par avec cachet corporate central.
- Pagination et bandeau de pied vert pétrole/doré.
- Le nouveau format est automatiquement appliqué aux impressions Projets, Métiers, Matériaux, Fournisseurs, Utilisateurs, Rapports, Tableau de bord et Journal Super Admin.
- Les informations imprimées sont celles réellement enregistrées dans Mon compte : nom, slogan, téléphone, e-mail, adresse, compte contribuable, RCCM et capital.


## V42 — Sortie obligatoire en PDF A4

- Tous les boutons d’impression sont renommés **PDF A4**.
- Suppression de la fenêtre d’impression du navigateur (`window.print`).
- Un clic génère et télécharge directement un fichier `.pdf`.
- Format physique PDF : **A4 portrait ou A4 paysage** selon la fiche.
- Générateur PDF autonome intégré à l’application : aucune bibliothèque distante/CDN requise.
- Conservation du modèle corporate V41.1 : entête entreprise, données légales, bandeaux, tableaux, statuts, signatures, cachet et pied de page.
- Pagination automatique des tableaux longs avec répétition de l’entête du document et de l’entête du tableau.
- Pagination PDF réelle : `Page X / Y`.
- Noms de fichiers automatiques contenant le titre du document, éventuellement le code projet, et la date d’édition.
- L’utilisateur ne peut plus choisir une sortie autre que PDF depuis les boutons d’édition du logiciel.
