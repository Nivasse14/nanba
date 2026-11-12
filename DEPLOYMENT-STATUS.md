# Pilote WhatsApp — 12 novembre 2026

Déploiement autorisé sur Render, My Workspace. Budget approuvé : application 512 Mo à 7 $/mois, WAHA 2 Go à 25 $/mois, deux volumes 1 Go à 0,50 $/mois au total. Région Frankfurt, services privés/publics séparés, aucune donnée de démonstration en production.

Branche distante `nanba-ensemble-pilot` de `https://github.com/Nivasse14/nanba`. Publication par l’interface GitHub : `Dockerfile.ensemble`, `render.ensemble.yaml`, `nanba-ensemble-source.tar.gz` à la racine. Commit publié : `4f920410db67f47f4c118f490974c15d0758ee7c`. Aucun changement au code mobile existant. Synchronisation et déploiement automatiques désactivés. Secrets API/HMAC/chiffrement générés par Render et partagés par références, jamais en Git.

`PILOT_SETUP_HASH` est ajouté séparément via la configuration Render. Il contient uniquement le SHA-256 d’une clé d’activation aléatoire. Cette clé est remise au propriétaire dans un fichier privé, n’apparaît ni dans les logs ni dans Git. L’activation exige ce secret et crée un seul administrateur ; elle est fermée dès le premier compte.

Le propriétaire définit son mot de passe puis ouvre Connexion WhatsApp. Il demande le QR, le scanne depuis le téléphone du bot, choisit un groupe consentant et peut envoyer un vrai sondage de test. Le serveur reste capable de gérer les inscriptions pendant une déconnexion du transport. Les réponses aux commandes restent des brouillons administratifs. Fournisseur IA et paiement non connectés.

WAHA session `default`, WEBJS 2026.10.1. Le code source officiel épinglé confirme GET /api/{session}/auth/qr, PUT /api/sessions/{session}, POST /api/sessions et POST /api/sessions/{session}/start. Le QR n’est accessible qu’au compte plateforme authentifié ; aucun accès direct public à WAHA.

Validation locale : 41 tests réussis, compilation TypeScript réussie, schéma JSON du Blueprint valide. La validation Render et les contrôles après déploiement sont suivis séparément.

## État distant vérifié

La publication GitHub a réussi après connexion et validation 2FA du propriétaire. Le connecteur GitHub renvoyait auparavant HTTP 403 « Resource not accessible by integration » ; le propriétaire a autorisé le passage par l’interface. La branche dédiée contient les trois fichiers nécessaires au déploiement.

Blueprint Render créé : `exs-dbr32mg8v5cc738qeue0`, nom `Nanba Ensemble · pilote WhatsApp`, workspace `tea-d9bb2v6rnols73dbkog0`. `autoSync: false`, ressources nouvelles, configuration `render.ensemble.yaml` sur la branche `nanba-ensemble-pilot`.

Le propriétaire a ajouté son moyen de paiement. La planification `exe-dbr35rrrjlhs73e25100` a réussi, sans avertissement ni variable manuelle obligatoire, et le déploiement autorisé a été lancé. Le budget de 32,50 $/mois et le déploiement sont déjà autorisés : ne pas redemander cet accord.

Application : `srv-dbr36g0n74is73d71k8g`, `https://nanba-ensemble-pilot-ufgg.onrender.com`. Déploiement actif après ajout de `PILOT_SETUP_HASH` : `dep-dbr36pb1vc2s739pd470`, état `live`. Disque `dsk-dbr36ggn74is73d71l40`, `/app/data`, 1 Go.

WAHA privé : `srv-dbr3600n74is73d704p0`, disque `dsk-dbr3600n74is73d7053g`, `/app/.sessions`, 1 Go. Image réellement téléchargée : `docker.io/devlikeapro/waha:latest-2026.10.1`, digest `sha256:a033abb9381a80246b9b3ec52141bfd7259e48bcea52286f53db25a013e526e0`. Le premier déploiement `dep-dbr3610n74is73d707d0` a atteint `live`. Correction du port privé : Render annonce `nanba-ensemble-waha-pilot-ufgg:10000`, donc `PORT=10000` et `WHATSAPP_API_PORT=10000`; `WAHA_PRINT_QR=false` évite les codes dans les logs. Déploiement de cette correction : `dep-dbr38t88v5cc738r1kr0`. Render a confirmé la détection du port 10000 dans ses logs.

Contrôles publics réellement exécutés : `/health` 200 avec mode `waha`; `/api/config` 200 avec `demo:false`, `setup:true`; `/` et `/app.js` 200; `/api/whatsapp/status` et `/api/whatsapp/qr` 401 sans authentification; POST `/api/setup` avec une mauvaise clé 403 `invalid_setup_key`. Page de connexion et formulaire d’activation vérifiés dans le navigateur. Preuves : `live-validation.json`. Aucun compte propriétaire créé par l’agent, aucun téléphone associé, aucun message réel envoyé.

L’accès propriétaire a été remis dans un fichier privé à usage unique. Seul son hash est configuré dans Render. Il ne doit pas être ajouté à ce dépôt.

L’archive publiée ne contient pas la spécification privée originale, ni données, sessions, clés ou node_modules.

## Reprise pour la recette WhatsApp

1. Vérifier l’état actuel des deux déploiements existants ; ne pas créer de nouveaux services ni réinitialiser les volumes.
2. Le propriétaire ouvre son lien d’activation privé et définit son mot de passe. Dès le premier compte créé, `/api/setup` se ferme définitivement.
3. Dans « Connexion WhatsApp », il lance la session, scanne le QR, autorise un groupe pilote consentant puis lance le sondage réel.
4. Vérifier réception et votes réels, provenance du groupe, absence de doublons et persistance après redémarrage. Ces contrôles attendent le téléphone du propriétaire.
5. Actualiser les limites/tests réalisés dans PROGRESS.md. Pour de futurs changements d’infrastructure, replanifier le Blueprint existant; `autoSync:false` et les déploiements automatiques restent désactivés.
