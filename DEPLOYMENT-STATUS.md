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

La première planification Render a échoué avec `need_payment_info` pour les deux services (`services[0]`, `services[1]`). Le contrôle `get_blueprint` confirme `status: created`, `resources: []`. Aucun service créé, aucun déploiement lancé, aucune URL de pilote active, aucune connexion WhatsApp réelle. Le propriétaire doit ajouter un moyen de paiement dans les réglages de facturation Render. Le budget de 32,50 $/mois et le déploiement sont déjà autorisés : ne pas redemander cet accord.

L’archive publiée ne contient pas la spécification privée originale, ni données, sessions, clés ou node_modules.

## Reprise après ajout de la carte

1. Replanifier le Blueprint existant avec `plan_blueprint`; ne pas en créer un deuxième.
2. Vérifier le plan des deux services Frankfurt et des deux volumes 1 Go. Appliquer avec `approve_blueprint` seulement si la planification a réussi et respecte le déploiement déjà autorisé.
3. Suivre les deux déploiements jusqu’à `live`, corriger toute erreur observée et vérifier `/health`, `/api/config` et la protection de `/api/whatsapp/*`.
4. Générer une clé propriétaire à usage unique et ajouter uniquement son SHA-256 dans `PILOT_SETUP_HASH` par mise à jour ciblée de l’environnement. Ne jamais inscrire cette clé dans Git ou les logs. Déployer la configuration si nécessaire.
5. Remettre au propriétaire son accès d’activation privé. Il choisit son mot de passe, scanne le QR WhatsApp, autorise son groupe pilote puis lance le sondage réel.
6. Vérifier le parcours réel avec le propriétaire et actualiser les limites/test réalisés dans PROGRESS.md.
