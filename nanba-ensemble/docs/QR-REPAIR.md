# Correctif de renouvellement du QR — 13 novembre 2026

**Mise à jour ultérieure :** voir `WHATSAPP-LOGIN-REPAIR.md`. Une adaptation
du nouveau bundle de connexion rétablit le QR natif et son renouvellement.
Les constats d'échec ci-dessous décrivent les essais précédents.

Symptôme remonté : le téléphone affiche « impossible de connecter l'appareil ».
Les logs WAHA montrent `window.require(...).Cmd.refreshQR is not a function`,
puis LOGOUT et fermeture de la page pendant l'authentification. L'erreur de
renouvellement est prouvée ; elle n'exclut pas un autre refus côté téléphone.
Une image QR disponible en HTTP ne prouve pas que l'association a réussi.

## Correctif testé puis désactivé

La dépendance WEBJS de WAHA 2026.10.1 appelle encore
`WAWebCmd.Cmd.refreshQR` lors du passage à `UNPAIRED_IDLE`. Sa propre méthode
`cancelPairingCode` utilise déjà `WAWebLaunchSocketUtils.refreshQR`.
Le correctif remplace uniquement le premier appel par le second, sans changer
l'authentification, les destinataires, les permissions ou les messages.
Il a été désactivé à la fin de l'investigation, car il n'a pas rétabli
l'association. Les scripts restent disponibles pour une validation ultérieure.

Source immuable de la dépendance, obtenue depuis le `yarn.lock` de WAHA :
https://raw.githubusercontent.com/devlikeapro/whatsapp-web.js/e2c7fdea6a2efad1e786c422e59f534eb45ab44c/src/Client.js

- SHA-256 original vérifié dans le conteneur : `2b047b691a7aca07581302daae041f8199802925447cd2bb9264fdb7de59dd5e`.
- SHA-256 corrigé : `8b8c70fbb40397a6307ad2f070ee32a6e0970c87216d6d5fca142aebc88476e5`.
- Le tag de la dépendance a évolué : utiliser le commit du lock, pas la branche.
- Le patch refuse toute autre révision et reste idempotent au redémarrage.

## Déploiement

Service WAHA existant `srv-dbr3600n74is73d704p0`, workspace
`tea-d9bb2v6rnols73dbkog0`. Image et volume inchangés :
`docker.io/devlikeapro/waha:latest-2026.10.1`, digest
`sha256:a033abb9381a80246b9b3ec52141bfd7259e48bcea52286f53db25a013e526e0`.

La variable de service `NODE_OPTIONS` précharge le patch au démarrage avec
`--import=data:text/javascript;base64,…` et conserve l'option mémoire de
l'image (`--max-old-space-size=16384`). Le module est embarqué dans la valeur,
sans téléchargement réseau ni secret. Le générer avec :

```sh
node scripts/waha-qr-node-options.mjs
```

Cette variable est gérée directement sur le service et omise du Blueprint
(un sync conserve les variables omises). La mise à jour de cette seule clé a
préservé toutes les autres variables, clés et disques. Aucun nouveau service.
Retirer le préchargement avant une mise à jour WAHA, ou revalider le correctif
contre la nouvelle dépendance. Retour arrière : remettre `NODE_OPTIONS` à
`--max-old-space-size=16384`, puis redéployer l'image inchangée. Le patch écrit
uniquement dans le système éphémère de l'image ; aucune session n'est effacée.

Le premier déploiement a refusé une révision non conforme
(`dep-dbrj6i5g1s2s738lgglg`). Un préchargement de diagnostic sans mutation a
rétabli le démarrage (`dep-dbrj7fcipgvc73fp9feg`) et confirmé la révision exacte.
Déploiement du correctif correspondant : `dep-dbrj86lg1s2s738ljfl0`.

## Validation

```sh
node scripts/verify-waha-qr-patch.mjs /chemin/Client.js
```

Six contrôles réussis sur Node 24.22.1 et le fichier original exact : seule la
cible est modifiée, syntaxe JavaScript valide, idempotence, reproduction de
l'ancienne méthode absente et exécution du nouvel appel, préchargement réel via
NODE_OPTIONS avant l'application, refus d'une autre révision sans modification.
Les 65 tests métier antérieurs ne sont pas présentés comme une recette du QR.

Le résultat distant et l'association réelle doivent être consignés après
vérification. Ne jamais conserver le QR, sa charge utile, les clés ou des
numéros privés dans les preuves.

## Récupération de la tentative inachevée

Le déploiement du patch est devenu `live`, avec le hash corrigé confirmé par
les journaux. Toutefois, la session est restée `STARTING` pendant plus de cinq
minutes : `Client.inject` attendait un état d'authentification pendant 30 s,
puis recommençait. Aucun état `WORKING` n'a été constaté.

La source WAHA 2026.10.1 (`WebJSAuthFactory.ts`, `LocalAuth.ts`,
`LocalStoreCore.ts`, `config.ts`) établit le chemin du profil Chromium :
`/app/.sessions/webjs/default/session-default`. La configuration WAHA et sa
base sont stockées séparément. Le script `waha-profile-recovery.mjs` déplace
une seule fois ce profil dans
`/app/.sessions/.nanba-recovery-20261113/session-default`, sur le même volume.
Il ne supprime aucun fichier et garde un marqueur persistant. Les démarrages
suivants conservent le nouveau profil, même après une association réussie.
Le script refuse les liens symboliques et une configuration de stockage
différente. Des contrôles locaux ont confirmé la sauvegarde intégrale du
profil, la conservation de la configuration et l'idempotence après création
d'un nouveau profil.

Cette récupération a été déclenchée après une nouvelle lecture confirmant
`STARTING`, `connected:false`, et après le `LOGOUT` observé précédemment.
Génération : `node scripts/waha-qr-node-options.mjs --recover-failed-profile`.
Déploiement : `dep-dbrjcbei0phs7381cok0`, devenu `live` le 13 novembre à
16:09:43 UTC. Le marqueur distant `already_preserved` confirme le passage du
préchargement. La disponibilité du QR et la connexion sont à vérifier séparément.

Retour arrière du profil, uniquement service arrêté : conserver le nouveau
`session-default` à part, puis remettre le dossier sauvegardé à sa place.
Ne pas restaurer ce profil après une nouvelle association réussie. La sauvegarde
contient des données d'authentification : ne pas la télécharger ni la journaliser.

La récupération n'a pas rétabli l'authentification : `STARTING` puis `FAILED`.
Le diagnostic en lecture seule `waha-auth-diagnostic.mjs` entoure `inject`
et conserve son résultat ou son exception d'origine. Il n'enregistre ni QR,
ni identifiant de compte, ni message. Le déploiement
`dep-dbrjdjd6e07s73btce1g` a révélé à 16:13:07 UTC :

```json
{"version":"2.3000.1054468000","socketPresent":false,"state":"undefined","hasSynced":false,"refreshFunction":"undefined","qrCanvasPresent":true}
```

La page WhatsApp courante ne fournit donc pas les objets attendus par ce
connecteur, malgré la présence d'un canvas. Le patch de renouvellement seul
ne peut pas résoudre ce second problème.

Test de compatibilité : `WAHA_WEBJS_CACHE_TYPE=local`, option définie dans
`WebJSEngineConfigService.ts`, pour charger le HTML fourni par l'image
(`2.3000.1018072227-alpha` dans `session.webjs.core.ts`). Déploiement
`dep-dbrjev5g1s2s738m26pg`. En cas d'échec, rétablir `none` ; ne pas présenter
une page servie ou un déploiement `live` comme une association réussie.

Le cache embarqué a échoué : `auth timeout`, sans version Web ni canvas QR.
L'option `none` a été rétablie dans `dep-dbrjfts9v7es73cp7tng`. Le diagnostic
à 16:18:03 UTC a confirmé `requireType:function`, `requireLazyType:function`,
mais aucun export dans `WAWebSocketModel` ni `WAWebLaunchSocketUtils`, avec
la version `2.3000.1054468000` et un canvas QR présent. Le chargeur existe ;
les modules attendus par le moteur ne sont pas disponibles. La cause précise
de cette absence (renommage, chargement différé ou autre changement amont)
n'est pas établie. Aucun contournement supplémentaire n'a été appliqué.

## État final : association non rétablie

Retour à la configuration de démarrage initiale : `dep-dbrjh6kipgvc73fq12m0`,
confirmé `live` à 16:20:06 UTC. Cela valide le déploiement, pas l’association.

Les préchargements de patch, récupération et diagnostic ont été retirés :
`NODE_OPTIONS=--max-old-space-size=16384`, `WAHA_WEBJS_CACHE_TYPE=none`.
L'image, les secrets, le volume et le service Nanba sont inchangés. La sauvegarde
du profil reste sur le volume ; aucun effacement. Aucune association `WORKING`,
aucun message WhatsApp ni aucun test utilisateur réel n'ont été validés.

Suite nécessaire : corriger la compatibilité du moteur avec la page WhatsApp
actuelle et tester le cycle QR + association sur un téléphone avant d'annoncer
le fonctionnement. Le compte administrateur Nanba n'est pas la cause de cet
échec d'initialisation du moteur.
