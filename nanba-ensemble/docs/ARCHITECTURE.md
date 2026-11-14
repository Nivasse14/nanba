# Architecture et contrats

## Pile et périmètre

Application Node 24.22.1 / TypeScript 5.9.3, modules natifs `http`, `sqlite`, `crypto`. Aucun paquet de production à installer. Interface HTML/CSS/JavaScript modulaire avec dictionnaire FR/EN ; aucune dépendance CDN. TypeScript est vérifié strictement, puis exécuté par Node (effacement natif des annotations). Prettier 3.6.2 assure la lisibilité du dépôt, sans imposer un framework.

SQLite WAL, clés étrangères, contraintes uniques et `BEGIN IMMEDIATE`. Une seule application modulaire et un worker durable par session. Cette pile vise un pilote sur un hôte avec disque persistant ; ne pas monter le fichier SQLite sur NFS ni multiplier les instances web sur des machines différentes. Pour une montée en charge distribuée, adapter le repository à PostgreSQL avec verrouillage des lignes et refaire les tests de concurrence.

`records` contient l’enveloppe relationnelle des objets (type, groupe, auteur, état, version) et les attributs spécifiques en JSON validé. Les données dont l’unicité et la concurrence sont critiques ont leurs propres tables : adhésions, identités, sondages, votes, intérêts, inscriptions, participations, outbox, inbox et paiements. `versions` conserve les révisions et `audit` des références sans corps de conversation.

## Accès et identité

Session opaque aléatoire, empreinte seulement en base, expiration 24 heures, cookie HttpOnly/SameSite=Strict et Secure en production. Scrypt pour les mots de passe ; token CSRF vérifié pour chaque mutation authentifiée. La vérification d’origine complète le CSRF. Limites de connexion et de requêtes persistantes ; corps HTTP limité à 64 Ko. Les requêtes SQL sont paramétrées.

`Context {userId, groupId}` est construit par le serveur depuis la session et le groupe demandé, puis vérifié dans les adhésions. Les champs `userId`, `ownerId`, `role`, `groupId` générés par le modèle ne remplacent jamais ce contexte. Même l’administrateur de plateforme doit être membre du groupe pour les API de groupe. Un administrateur ne voit pas une recherche logement privée.

Liaison WhatsApp : code aléatoire à usage unique, 10 minutes, lié au compte et au groupe. Une commande `/lier CODE` reçue par webhook authentifié prouve l’identité fournisseur de l’émetteur. Refus de réassignation et d’une seconde identité dans la même session. Le LID reste un LID. En production, pseudonyme HMAC-SHA256 et référence chiffrée AES-256-GCM avec la clé privée persistante. La clé doit être sauvegardée et ne pas changer sans migration. Le mode synthétique n’exige pas de clé parce qu’il n’héberge que des identités fictives.

Les intérêts app et WhatsApp d’un compte lié sont réconciliés à la lecture par identité canonique : dernier état daté, égalité donnant priorité à l’action app explicite. Les identités non liées restent provisoires. La transition `threshold_reached` est enregistrée une seule fois ; le seuil actuellement atteint est calculé à partir des intérêts actuels. Un seuil franchi ne confirme aucune offre.

## Règles significatives

- Sondage simple par défaut, structure compatible choix multiples. Les options possèdent des ID stables ; le transport utilise leurs libellés. `yes` signifie intérêt. Les derniers choix remplacent le précédent instantané de vote.
- Timestamp WAHA : secondes dans le contrat épinglé, conversion explicite en millisecondes. Un timestamp ambigu n’est pas deviné. Événements hors ordre ignorés ; mêmes timestamps avec contenus incompatibles : état incertain, exclu du compteur jusqu’à une nouvelle mise à jour.
- `poll.vote.failed` crée un incident, sans effacer le dernier vote déchiffré. Les votes postérieurs à l’échéance sont ignorés. Les événements antérieurs reçus jusqu’à 48 heures après l’échéance sont appliqués ; au-delà, ils sont conservés dans l’inbox et marqués pour examen dans l’audit. Les résultats peuvent donc être réconciliés pendant cette fenêtre.
- L’offre est confirmée par son auteur professionnel. Prix/date/conditions révisés créent une nouvelle version et remettent les inscriptions en `reconfirm`. La capacité reste réservée à ces membres jusqu’à acceptation ou désistement.
- Les inscriptions `confirmed`, `offered` et `reconfirm` consomment des places. La file d’attente est FIFO ; une proposition de place expire au bout de 24 heures. Une personne n’est pas inscrite automatiquement à la place proposée. Une répétition identique n’altère pas la position.
- Le statut « intéressé » dans WhatsApp ne crée jamais d’inscription. Nanba est l’autorité d’inscription.
- Aide : plages de temps réservées dès la proposition du volontaire, puis double consentement. Limite sur la semaine UTC du lundi au dimanche, annoncée dans l’exploitation. Annulation/libération atomique, aucun score de réputation.
- Radar : produit 24 h, horaires 72 h, événement 168 h, autre 48 h à partir de l’observation. Confirmation administrative documentée jusqu’à 720 h. Un signalement contesté quitte les réponses actuelles.
- Défi : inscription pendant `registration`, liste figée à `open`. Score ville = somme des points / adultes inscrits à l’ouverture, absence = 0. Aucune rémunération. Une participation unique par compte. Carte agrégée sans noms, donc aucune donnée individuelle publiée même si une préférence de visibilité est activée.
- Récit : édition invalide tout accord précédent ; validation explicite de l’auteur sur le texte original, la traduction et les publics. L’admin ne lit le brouillon privé qu’après accord. Nanba et WhatsApp sont les seuls publics pris en charge ; TikTok n’est jamais déduit.

## API

Préfixe `/api`. Réponses JSON et erreurs `{error: code}`. Les mutations nécessitent cookie de session, `X-CSRF-Token` et `X-Group-Id`. Les lectures de groupe nécessitent ce dernier et la session.

| Route | Contrat |
|---|---|
| `POST /login`, `POST /logout`, `GET /me` | Sessions et groupes autorisés |
| `GET /records?kind=…`, `POST /records` | Liste filtrée et création validée par module |
| `GET /records/:id` | Présentation filtrée (pas de réponses du défi avant clôture, pas de coordination avant inscription) |
| `POST /records/:id/action` | `{action,…}` ; validation métier et transaction |
| `GET /records/:id/calendar` | Calendrier ICS, dates UTC, événement affiché Europe/Paris |
| `GET /records/:id/card` | SVG exact, histoire approuvée ou résultats de défi clôturé |
| `GET /records/:id/leaderboard` | Classement calculé côté serveur |
| `POST /identity/link` | Code de liaison temporaire |
| `POST /preferences` | Consentements séparés et langue déclarée |
| `GET /privacy/export`, `POST /privacy/delete` | Export du compte ; suppression avec mot de passe |
| `GET /knowledge`, `POST /matches` | Recherche filtrée et critères de rapprochement expliqués |
| `POST /agent`, `POST /agent/tool` | Brouillon IA / outils strictement autorisés |
| `GET /admin`, `POST /admin/action` | Groupes, rôles, pauses, partenaires, incidents et audit |
| `POST /admin/process`, `POST /admin/collect` | Traitement autorisé et collecte d’une source enregistrée |
| `POST /admin/simulate-vote` | Auth admin, développement uniquement, simulation uniquement |
| `POST /webhooks/waha` | Corps authentifié HMAC, normalisation puis inbox durable avant 202 |
| `POST /payment/checkout` | Indisponible tant qu’aucun fournisseur n’est injecté |
| `POST /webhooks/payment` | Vérification du fournisseur obligatoire, jamais action navigateur |

Les actions exactes et leurs validations sont regroupées dans `src/modules.ts`, `src/collective.ts` et `src/admin.ts`. Les tests HTTP donnent des exemples exécutables du module 1.

## Intégration au vrai Nanba

Aucun endpoint de Nanba n’est inventé. Remplacer les ports suivants après inspection du vrai dépôt :

| Domaine | Port actuel | Raccordement à fournir |
|---|---|---|
| Identité | `authenticated`, `Context`, memberships | Identité du SSO Nanba vérifiée côté serveur ; mapping opaque compte/groupe/organisation ; ne jamais faire confiance à un en-tête utilisateur non signé |
| Catalogue immobilier | `NanbaCatalog.searchAuthorized` | Recherche dans le catalogue existant ; autorisations et abonnement du professionnel dans le service Nanba |
| Offres logement | `listingRef`, `source` | Référence du bien Nanba et horodatage réel de confirmation ; pas de miroir du catalogue |
| Abonnements | `organizations.subscription` | Entitlement existant, révocation serveur ; valeur `pilot` actuellement |
| WhatsApp | `WhatsAppConnector` | WAHA ou autre transport, avec matrice par moteur/version |
| Paiement | `PaymentProvider` | Checkout du fournisseur retenu et signature réelle ; événement canonique vérifié |
| Traduction/audio | `TranslationProvider`, `TranscriptionProvider` | Fournisseur, limites, stockage privé et vérification auteur |
| Calendrier | `calendarEvent` | Export ICS sans droits sur une boîte mail ou un agenda complet |
| IA | `Agent` | Endpoint HTTPS compatible avec le contrat Chat Completions, modèle et clé explicites |

Paiement : montant en centimes, devise, bénéficiaire, inscription, version acceptée et identifiant fournisseur vérifiés avant passage à `paid`. Déduplication `(provider,eventId)`. L’événement doit venir du `verifyWebhook` du fournisseur. La méthode interne `applyVerified` n’est jamais exposée à une entrée HTTP libre. La commission est séparée (`commission_bps`), valeur pilote 0.

## Connaissances et IA

Collecte uniquement de sources enregistrées par un admin, formats JSON Feed/RSS/Atom, 512 Ko max, délai 8 s, redirections refusées. DNS résolu puis adresse publique IPv4 épinglée au socket TLS ; plages privées, IP littérales, ports non 443, IPv6 et déclarations d’entités XML refusés. Le flux ne peut référencer que son propre domaine. Aucune collecte de conversations externes, d’HTML authentifié ou de média arbitraire.

Chaque document conserve publication (si connue), collecte, événement, vérification et expiration séparément. Les mises à jour redeviennent `pending`; la collecte ne crée pas de vérification factuelle. Les démarches exigent un domaine officiel autorisé. Recherche textuelle sur contenu vérifié et courant ; un filtre de publication exclut les dates inconnues et les vieux articles.

L’IA reçoit uniquement la demande explicite et un petit ensemble de documents publics autorisés. Elle ne reçoit ni logement privé, ni dossier, ni historique intégral du groupe. Les extraits sont des données non fiables. Seuls des brouillons sont retournés, jamais exécutés automatiquement. Outils typés : recherche, rencontres, demande collective, entraide, radar et récit. Pas de shell, SQL, paiement ou publication générique. 20 appels/jour/utilisateur par défaut, 200/groupe, 20 000 tokens/utilisateur ; sortie plafonnée à 1 000 tokens, délai 12 s, aucun retry automatique. Sans métrique fournisseur, une estimation conservative de 5 000 tokens est débitée. Le coût monétaire exact nécessite les tarifs contractuels du fournisseur ; les métriques n’inventent pas de coût en euros.

Les commandes reçues dans les groupes créent des réponses structurées en file éditoriale. Elles ne publient pas automatiquement. Les membres non liés peuvent voter, mais doivent ouvrir Nanba/se lier pour accéder aux parcours engageants. Les messages ordinaires et ceux du bot sont ignorés avant conservation.
