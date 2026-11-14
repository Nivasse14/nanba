# Adaptation du parcours de connexion WhatsApp — 13 novembre 2026

## Cause observée

Sur WhatsApp Web `2.3000.1054468000`, le bundle de connexion fournit
`WAWebLoginLaunchSocketUtils.refreshLoginQR`. `WAWebSocketModel` est enregistré
mais son export `Socket` n'est pas disponible avant l'association. L'ancien
WEBJS attend cet export et dépasse son délai de 30 secondes, alors qu'un
vrai QR WhatsApp est affiché. Le simple remplacement de `Cmd.refreshQR`
et le cache HTML ancien n'ont pas rétabli ce parcours.

Diagnostic réel : registre de 6 671 modules, QR natif de cinq champs et
277 caractères dans l'attribut `data-ref` du parent du canvas. La fonction
native `refreshLoginQR` est sans paramètre et redémarre le transport de
connexion. Aucun QR, identifiant, message ou secret n'a été journalisé.

## Changement

`scripts/waha-login-compat.mjs` adapte uniquement `Client.inject` pendant
le parcours de connexion séparé :

- Transmet le QR natif de WhatsApp par l'événement QR déjà géré par WAHA.
- Ignore un QR incomplet ou identique au précédent.
- Renouvelle le QR uniquement lorsque l'interface WhatsApp demande de le
  recharger, jamais sur un minuteur qui interromprait une association.
- Attend que le module classique soit disponible pour appeler l'initialisation
  WEBJS d'origine. N'émet jamais d'événement `AUTHENTICATED` ou `READY` lui-même.
- Annule l'observateur précédent à la navigation, s'arrête quand le navigateur
  ferme et borne les attentes sans progression.

Le paquet est vérifié avant installation : SHA-256 de `Client.js`
`2b047b691a7aca07581302daae041f8199802925447cd2bb9264fdb7de59dd5e`, commit
amont `e2c7fdea6a2efad1e786c422e59f534eb45ab44c`. Une autre version est refusée.
Pas de changement des comptes, droits, messages, groupes, sondages ni webhooks.

## Déploiement et retour arrière

Service existant `srv-dbr3600n74is73d704p0`, workspace
`tea-d9bb2v6rnols73dbkog0`, image `devlikeapro/waha:latest-2026.10.1`, digest
`sha256:a033abb9381a80246b9b3ec52141bfd7259e48bcea52286f53db25a013e526e0`.
Premier essai `dep-dbrjnfkipgvc73fqgblg` : attente encore bloquée. Après
attente explicite de l'initialisation du runtime WhatsApp et adaptation du
validateur du QR natif, déploiement `dep-dbrjos3tqb8s73eoskp0`, confirmé
`live` à 16:36:44 UTC.

La seule clé changée est `NODE_OPTIONS`, qui contient le préchargement produit
par `node scripts/waha-login-node-options.mjs`. Le cache reste `none`. Les
préchargements de diagnostic et de réparation précédente sont remplacés.
Ni nouveau service ni coût supplémentaire. Volume et secrets conservés.

Retour arrière : remettre `NODE_OPTIONS=--max-old-space-size=16384` et
redéployer. Le code du module est embarqué dans cette variable, sans secret
et sans téléchargement au démarrage. Retirer ou revalider ce module avant
de mettre à jour WAHA. La variable est gérée sur le service ; les futurs
changements de Blueprint doivent tenir compte de ce correctif.

## Validation

`node scripts/verify-waha-login-compat.mjs` vérifie QR authentique, déduplication,
rechargement à expiration, délégation au moteur original, absence de faux
événement de connexion, délai, fermeture et annulation à la navigation.
Ces tests passent. Le navigateur réel et l'association du propriétaire
sont des vérifications séparées, à consigner ci-dessous.

Contrôle distant : le serveur a détecté à 16:36:56 un QR natif de cinq champs,
277 caractères, et la nouvelle fonction de connexion. L'API privée retourne
`SCAN_QR_CODE`, `connected:false` avec une image PNG. Deux empreintes de QR
distinctes ont été observées entre 16:36:50 et 16:38:02, ce qui confirme un
renouvellement réel. Les preuves sans contenu de QR sont dans
`qr-native-login-observations.json`. L'association sur le téléphone reste à
faire par le propriétaire ; aucun message envoyé, aucun état `WORKING` annoncé.

La tentative de publication de la source sur la branche existante a été
refusée par GitHub (`403 Resource not accessible by integration`). Le correctif
actif et persistant est bien embarqué dans `NODE_OPTIONS` du service Render.
Les sources et la procédure sont également conservées dans le dépôt local.
Publier ces fichiers dans la branche du pilote dès que l'accès GitHub en
écriture est rétabli, avant de refondre le déploiement ou de mettre à jour WAHA.

Dernier contrôle continu : neuf observations toutes en `SCAN_QR_CODE`,
16:36:50–16:41:36 UTC, six empreintes QR distinctes. Aucun timeout ni erreur
WAHA dans les journaux contrôlés jusqu’à 16:41:49 UTC. Le scan réel reste
non effectué (`connected:false`). SHA-256 du module déployé :
`8408808e5e17f4f84fd38bf7292dd830d09668c942508593fea7d32cb1c3e9bd`.


## Association confirmée — 16:50 UTC

Le propriétaire confirme le scan réussi sur son téléphone, mais la page était
restée au QR. L’API était encore `SCAN_QR_CODE`. Relance contrôlée avec le même
profil persistant, sans nouvelle association ni effacement, pour diagnostiquer
la transition : déploiement `dep-dbrjuimi0phs7382se0g`, live à 16:49:19 UTC.
Le navigateur retrouve le compte associé (`selfAvailable:true`), les modules
classiques sont chargés et l’initialisation WEBJS d’origine est exécutée.
L’API privée confirme désormais `WORKING`, `connected:true`,
`personalTestReady:false`. La page doit proposer « Activer mon test personnel ».
En cas de page figée, rouvrir le lien privé complet (le fragment public
`#whatsapp-start` seul ne contient plus la clé conservée en mémoire).

Le diagnostic temporaire ne contient que des indicateurs booléens et des
noms de modules ; il cesse après la délégation au moteur d’origine. Le module
actif a le SHA-256 `d3adb46c0a9357b80472fed2fc20066b9a38deb10e969009454e5aeb8e7fdc78`.
Preuve : `whatsapp-connected-validation.json`. Aucun message envoyé et test
personnel non activé par l’agent. Réception et réponses restent à tester.
