# Exploitation et activation limitée

## Ce qui a été autorisé et exécuté

Construction, installation des dépendances de développement, migrations locales, données fictives, tests, serveur de prévisualisation local. Aucun compte réel connecté, aucun message à un tiers, paiement ou déploiement public.

## Démarrer un pilote réel, après autorisation

1. Installer l’application sur un hôte durable avec TLS, disque chiffré, sauvegardes et gestionnaire de secrets. Prévoir un processus permanent, pas une fonction éphémère ni une mise à zéro automatique. Garder WAHA dans le réseau privé, accès API restreint, pas d’exposition de Swagger ou du tableau de bord.
2. Créer **une nouvelle base vide** (`data/pilot.db`), distincte de la démonstration. Le marqueur `runtime_mode` empêche de passer une même base de simulation à réel.
3. Provisionner les utilisateurs adultes et groupes autorisés depuis le vrai Nanba ou via le script de bootstrap exécuté sur l’hôte de confiance. `npm run provision` lit un objet JSON sur stdin, sans afficher ni enregistrer le mot de passe. Il attend `email`, `name`, `password` (au moins 14 caractères), `role`, `groupId`. Pour le premier admin : `platformAdmin:true`, `groupName`, `zone`. Pour un professionnel : `orgId`, `orgName`. Alimenter stdin depuis un gestionnaire de secrets ou une session terminal protégée ; ne pas placer les secrets dans l’historique de commandes.
4. Générer une clé privée de 32 octets pour `IDENTITY_ENCRYPTION_KEY` (64 caractères hexadécimaux), une clé API WAHA et un secret HMAC webhook d’au moins 32 caractères. Les conserver hors Git, chiffrés au repos. Préserver les clés dans les sauvegardes sécurisées ; leur perte casse la liaison et le déchiffrement d’identités.
5. Vérifier les avis de sécurité et le digest de l’image 2026.10.1 retenue. `compose.waha.yaml` est fourni pour démarrer WAHA seul, **sans connexion automatique de session**. Son port est lié à l’interface locale ; un administrateur autorisé établit ensuite la session avec un compte pilote dédié.
6. Configurer les variables : `NODE_ENV=production`, `DATABASE_PATH=data/pilot.db`, `WHATSAPP_MODE=waha`, `WAHA_URL`, `WAHA_SESSION=nanba-pilot`, `WAHA_ENGINE=WEBJS`, `WAHA_API_KEY`, `WAHA_WEBHOOK_SECRET`, `IDENTITY_ENCRYPTION_KEY`, `APP_ORIGIN=https://votre-hote`. Ne mettre `ALLOW_REAL_SEND=true` qu’après autorisation d’utiliser ce compte et les groupes concernés.
7. Configurer le webhook HMAC décrit dans WHATSAPP.md. Créer le groupe manuellement dans WhatsApp, ajouter le compte dédié, puis enregistrer son identifiant dans Nanba. La création automatisée du groupe ou d’une Communauté n’est pas requise.
8. Définir les adhésions, organisations et droits Nanba. Vérifier la liste des participants via le compte pilote : ne pas transformer automatiquement un rôle WhatsApp en rôle Nanba. Les consentements de notifications privées restent distincts de l’appartenance au groupe.
9. Faire une recette limitée avec des participants consentants : texte, sondage, changement/retrait, votes multichoix si retenus, liaison volontaire, redémarrage moteur, vote sur ancien sondage, déconnexion, timeout, relecture du journal et pause. Ne pas activer médias ou événements natifs sur la seule foi de la matrice d’un autre moteur.

## IA et autres fournisseurs

L’IA s’active indépendamment : `AI_BASE_URL` HTTPS (sans `/chat/completions` final), `AI_MODEL`, `AI_API_KEY`. Le serveur appelle le contrat Chat Completions standard, avec délais et budgets. Adapter le port si le fournisseur choisi diffère. La clé n’est jamais exposée au navigateur. Les langues tamoul/Tanglish restent non évaluées jusqu’à une recette humaine.

Sans clé, la réponse indique « non connecté » et propose les formulaires. Aucun faux résultat d’IA n’est produit. Les commandes de groupe génèrent des brouillons éditoriaux, dont la publication reste autorisée par un admin.

Paiement : injecter une implémentation `PaymentProvider` dans `Payments`, dotée de la vérification de signature réelle et des identifiants serveur de commande. Le squelette refuse les checkouts tant qu’elle manque. Aucun paiement provenant d’un retour navigateur. Vérifier montant, monnaie, bénéficiaire, réservation et version avant chaque transition. Aucun scope bancaire ou e-mail global n’est demandé.

Traduction/transcription/médias : les interfaces sont dans `src/integrations.ts`. Sans fournisseur, les textes peuvent être saisis manuellement. N’activer les médias qu’après ajout d’un stockage privé, de limites de type/taille, d’une analyse de fichier et d’une procédure de retrait. Le service actuel ne reçoit pas de pièces jointes, donc aucun upload public non contrôlé.

## Pause et reprise

- L’administrateur de groupe peut suspendre les publications ; le compte plateforme dispose d’une pause générale. `/pause` dans WhatsApp exige une identité liée ayant les droits du groupe.
- La pause annule les tâches `pending`/`prepared` concernées. La reprise ne les renvoie pas silencieusement : créer/valider un nouveau brouillon si nécessaire.
- Une session déconnectée conserve les éléments en attente. Le worker recommence son contrôle de connexion lors des cycles suivants.
- Après timeout, `uncertain` reste bloqué. Vérifier dans WAHA/WhatsApp si le message existe, puis renseigner l’identifiant fournisseur et le justificatif dans la réconciliation administrative. Si l’absence d’envoi est prouvée, préparer un nouveau contenu au lieu de réessayer aveuglément l’original. Aucun retry automatique d’un résultat incertain.
- Les événements inbox en échec sont visibles et peuvent être relancés par l’administrateur après correction. Les clés de déduplication restent présentes. Une erreur de vote ne devient pas un retrait.
- Un redémarrage transforme les envois restés `sending` en `uncertain`. La reprise automatique ne considère jamais que l’envoi a réussi.

## Sauvegarde et restauration

`npm run backup` utilise `VACUUM INTO` pour produire une copie cohérente de SQLite, y compris quand la base principale est en WAL. Le script refuse d’écraser une sauvegarde et applique des permissions locales 0600.

Pour restaurer : arrêter l’application et le worker, copier la sauvegarde dans un **nouveau chemin**, configurer `DATABASE_PATH` vers ce fichier, restaurer séparément clés et volume de session WAHA, puis démarrer d’abord en pause. Ne pas remplacer une base ouverte. Vérifier les migrations, les marqueurs de transport, l’inbox/outbox et les états incertains avant reprise. Ne pas restaurer une base simulée en mode réel.

La conservation des clés de session WAHA est indispensable à la reprise des sondages : tester cette restauration dans un environnement pilote autorisé.

## Supervision

`/health` indique la disponibilité du processus, pas l’état d’une réservation. L’admin affiche la connexion contrôlée, les envois en attente/incertains, échecs, votes non déchiffrés, inscriptions confirmées, âge du plus ancien événement, sources périmées et usage IA. Les métriques numériques sont disponibles dans `GET /api/admin`, avec authentification et scope de groupe. Brancher cette réponse sur l’observabilité de Nanba ; aucun service d’alerte externe n’est connecté.

Inspecter : tout `uncertain`, événement `failed`, ancienneté d’inbox supérieure à deux minutes, session `disconnected`, source expirée, taux d’erreurs IA. L’hôte doit également superviser HTTP, disque, processus et sauvegardes.

`RETENTION_DAYS=90` par défaut pour événements traités et audit ; sessions/codes temporaires expirés supprimés. Les contenus métier demeurent jusqu’au retrait/suppression pour ne pas effacer des inscriptions actives. Export et suppression du compte sont authentifiés ; l’effacement retire les contenus et votes associés, annule les engagements concernés et conserve uniquement les références techniques nécessaires aux relations. Les copies externes et les obligations de conservation d’un futur paiement devront être intégrées à la politique Nanba réelle.

## Points à valider avant usage réel

- SSO/catalogue/abonnements Nanba et logo authentique ; identité des organisateurs et professionnels.
- Recette WAHA avec l’image exacte, licences des moteurs et état des avis de sécurité.
- Politique de conservation, chiffrement du volume, sauvegardes et restauration des clés.
- Compatibilité du fournisseur IA, qualité des traductions et tarification contractuelle.
- Parcours mobile sur de vrais appareils, tests d’accessibilité approfondis, charge et déploiement.

Ces points sont des connexions/validations réelles non effectuées, pas des actions annoncées comme réussies.
