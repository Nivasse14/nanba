# État de réalisation — Nanba Ensemble

Mis à jour le 12 novembre 2026. Spécification intégrale : [SPECIFICATION.txt](SPECIFICATION.txt).

## Point de départ et portée livrée

Aucun dépôt Nanba existant, endpoint métier, SSO, logo ni compte fournisseur n’était accessible. Application autonome et intégrable : TypeScript / Node 24, SQLite transactionnel, API HTTP, sessions, interface FR/EN responsive, rôles et administration. Le raccordement au vrai Nanba reste à effectuer.

Les huit parcours fonctionnent localement avec persistance. Le mode simulé est isolé : inscriptions locales, aucun paiement ou réservation externe, aucun message WhatsApp réel. Les dépendances absentes sont refusées explicitement ou représentées par des interfaces ; elles ne produisent pas de faux succès.

## Plan réalisé

- [x] Lire toute la spécification, examiner les fichiers et les instructions.
- [x] Fondations et chaîne complète du premier module.
- [x] Sept autres modules et écrans reliés au backend.
- [x] Permissions par groupe/organisation, consentements, audit et effacement.
- [x] Transports simulé/WAHA, inbox/outbox, pause et reprise.
- [x] Collecte, connaissances, brouillons IA, digests et administration.
- [x] Validations locales, documentation et livraison reproductible.
- [ ] Raccordement au vrai Nanba et recette des services externes autorisés.

## Matrice fonctionnelle et preuves

| Module | Fonctionnel localement | Tests réellement exécutés | Activation externe / limites restantes |
|---|---|---|---|
| 1. Demandes collectives | Besoin, intérêts, sondage validé, votes, seuil, offre confirmée par son auteur, conditions versionnées, inscriptions, attente, annulation | Domaine + HTTP de bout en bout, redémarrage, changements/retraits/doublons/votes tardifs, ambiguïtés, seuil unique, six connexions simultanées pour une place, réacceptation | Compte WAHA et recette moteur réelle ; partenaire réel ; fournisseur de paiement éventuel |
| 2. Petites rencontres | Création, rapprochement explicable, capacité, attente, proposition de place avec expiration, coordination protégée, ICS | Accès à la coordination, désistement, promotion et expiration de place ; capacité | Notification WhatsApp réelle ; lieu/organisateur à confirmer hors application |
| 3. Logement | Demande privée, professionnels choisis, propositions référencées, disponibilité datée, intérêt/contact, révocation, pause et retour | Isolation groupes/organisations, refus à l’admin non autorisé, révocation immédiate, disponibilité périmée | Catalogue, comptes et abonnements professionnels Nanba ; aucune disponibilité de bien réel vérifiée |
| 4. Entraide | Profil, compétences/langues, plages horaires, limite hebdomadaire, pause, proposition, double accord, annulation et retour | Chevauchements, limite et pause, double acceptation, libération du créneau et effacement du volontaire | Notifications réelles ; aucun fournisseur nécessaire au parcours local |
| 5. Radar | Provenance, observation, expiration par catégorie, modération, dédoublonnage, correction, contestation, reconfirmation versionnée | Horloge contrôlée, disparition après expiration, reconfirmation, sources administratives et protection de la collecte | Sources réelles et modérateurs à configurer ; collecte réseau réelle non recettée |
| 6. Nouveaux arrivants | Cohortes, thèmes, étapes, ressources, inscriptions, activités rejointes, progression privée, mentorat | Persistance et confidentialité de la progression, activité soumise à inscription préalable | Contenus officiels et mentors réels à sélectionner ; notification externe |
| 7. Défis entre villes | Préparation, validation du contenu, équipes, inscriptions, effectif figé, réponses uniques, résultat calculé, contestation/correction tracée, carte SVG | Calcul reproductible, dénominateur figé, réponses doubles et tardives rejetées | Éditorial réel à valider ; publication WhatsApp |
| 8. Histoires familiales | Original/traduction, accord auteur par version/canal, validation éditoriale, carte bilingue, retrait | Refus sans consentement, changement invalidant l’accord, retrait masquant les surfaces et annulant les publications en attente | Traduction/transcription automatiques et stockage média non branchés ; saisie bilingue manuelle opérationnelle ; tamoul/Tanglish non évalués |

## Résultats de validation

Environnement : Node 24.22.1, SQLite natif. Bases jetables et données synthétiques indépendantes de la démonstration.

| Commande / contrôle | Résultat observé |
|---|---|
| `npm run check` | Build et vérification TypeScript réussis ; **37 tests réussis, 0 échec, 0 ignoré** |
| `node --check public/app.js` | Syntaxe du client valide |
| `npm run format:check` | Formatage conforme |
| `npm audit --json` | 0 vulnérabilité npm signalée ; ne couvre pas WAHA, Node ou l’hôte |
| `npm run backup`, puis `PRAGMA integrity_check` sur la copie | Sauvegarde créée, résultat `ok`, 12 enregistrements métier conservés |
| Navigateur ordinateur | Profils synthétiques, création d’une demande, intérêt, validation de sondage et traitement simulé, administration, bascule FR/EN, fiche bilingue ; accueil final contrôlé visuellement |

Preuves textuelles : `validation-output.txt`. Tests : `tests/domain.test.ts`, `tests/http.test.ts`, `tests/transport.test.ts`.

Autres validations : HMAC SHA-512 sur corps brut, isolation sessions/groupes, options/timestamps WAHA, déchiffrement en échec distinct d’un retrait, déconnexion, timeout durable `uncertain`, reprise sans doublon, révocation avant envoi, pause annulant les tâches, déduplication de digest, SSRF/XML interdits, refus de faux paiement, export/effacement et panne IA sans blocage métier.

## Problèmes corrigés

Paramètres SQL de votes/commandes ; visibilité des offres modifiées pour les inscrits devant reconfirmer ; maintien de la position d’attente après répétition ; absence de promotion après annulation ; annulation des inscriptions lors de l’effacement d’un organisateur ; libération des créneaux du volontaire supprimé ; types des boutons de formulaire ; dates Europe/Paris ; port de prévisualisation ; séparation du compose WAHA optionnel.

## Limites non couvertes localement

Aucun conteneur Docker exécuté, compte WhatsApp connecté, message tiers envoyé, fournisseur IA réel appelé, paiement effectué ou déploiement public. Contrats WAHA vérifiés contre la documentation 2026.10.1 et des réponses synthétiques, sans certification en situation réelle. WEBJS ne fournit pas ici d’événement natif, fermeture/édition native de sondage ou masquage des votants.

Le navigateur n’a pas permis une recette à largeur mobile réelle. Responsive CSS livré ; validation sur appareils, accessibilité approfondie et charge restent à réaliser. Aucun bug bloquant connu dans les parcours testés ; cela ne constitue pas une certification de production.

## Reprise de session

1. Lire ce fichier, README.md et les limites de WHATSAPP.md / OPERATIONS.md.
2. Node 24.22.1+, puis `npm ci`, `npm run check`, `npm run dev`. Ne pas réinitialiser la base persistante existante.
3. Intégration Nanba : fournir dépôt/API/SSO, implémenter les ports de `src/integrations.ts`, réutiliser comptes et catalogue.
4. WAHA : compte pilote dédié, secrets, groupe autorisé, image épinglée et recette limitée selon OPERATIONS.md. Ne pas transformer une base simulée en base réelle.
5. Ajouter les autres fournisseurs un à un, effectuer leur recette puis actualiser cette matrice. Les actions externes gardent les autorisations requises.

## Préparation du pilote WhatsApp — suite

Budget Render 32,50 $/mois et déploiement approuvés. Ajout de l’activation propriétaire à usage unique et de l’écran de connexion WhatsApp (QR privé, groupe autorisé, sondage de test). **41 tests réussis**, TypeScript et schéma JSON du Blueprint valides. Publication GitHub effectuée sur `nanba-ensemble-pilot`, commit applicatif `4f920410db67f47f4c118f490974c15d0758ee7c`. Après ajout de la carte par le propriétaire, le Blueprint `exs-dbr32mg8v5cc738qeue0` a créé l’application et WAHA privé avec deux disques persistants. Le site `https://nanba-ensemble-pilot-ufgg.onrender.com` répond en mode réel, sans démonstration; activation à usage unique disponible. Six contrôles GET et un refus de mauvaise clé POST validés à distance, plus vérification navigateur. Correction du port privé WAHA vers 10000 et suppression des QR dans les logs. Les tests téléphone, QR et sondage réel restent à faire avec le propriétaire. Détails, ressources et reprise dans DEPLOYMENT.md; preuves dans live-validation.json.

## Assistant utilisable directement dans WhatsApp — 12 novembre 2026

Réponses automatiques guidées et test personnel sans compte web ajoutés : lien privé, QR, activation de la discussion « Vous », menu, proposition en plusieurs étapes, confirmation, sondage, résultats, consultation des contenus autorisés et recherche de sources validées. Migration 002 persistante. 48 tests locaux réussis, compilation et syntaxe navigateur validées. L’IA généraliste n’est pas configurée ; les réponses ne prétendent pas être générées par un modèle connecté. Aucun message téléphonique réel vérifié avant association par le propriétaire. Les résultats précédents de ce fichier sont historiques ; les services Render et WAHA sont désormais déployés, voir DEPLOYMENT.md.

Validation distante finale : application conversationnelle live, démarrage WAHA réel et QR privé PNG vérifiés. La référence réseau du service privé a été rafraîchie après modification de port. Preuves sans secrets : whatsapp-live-validation.json. L’unique étape utilisateur restante pour le test personnel est le scan, puis le bouton d’activation ; aucun message réel envoyé avant cette étape.

## WhatsApp complet — travail en cours

Objectif autorisé : rendre les huit modules et leur administration utilisables depuis WhatsApp. Plan : conversations privées liées aux groupes, formulaires guidés et confirmations versionnées, actions métier/administration, tests de parcours et de confidentialité, publication sur la branche pilote puis déploiement du service existant. Aucun nouveau service ni budget demandé. WAHA reste le transport ; les dépendances externes absentes ne doivent pas produire de faux succès.

### Réalisation WhatsApp complète v2

Les huit modules ont maintenant des parcours conversationnels de création, détail, action et confirmation. Ajouts : conversations privées autorisées par le premier message d'un membre déjà lié à un groupe ; sélection de communauté ; formulaires persistants avec retour/annulation ; conditions versionnées ; inscriptions/attente/désistement ; choix des professionnels et révocation ; bénévolat et double accord ; modération radar ; progression privée ; création/questions/équipes/réponses/résultats de défi ; auteur/relecture/canaux/retrait des histoires. Les publications de groupe donnent des commandes WhatsApp et excluent les champs privés. Administration WhatsApp : rôles, partenaires vérifiés, modération, suivi/réconciliation d'envois, sources/documents/digests. Autorisation d'un nouveau groupe uniquement sur commande explicite du propriétaire dans le groupe depuis son téléphone lié.

Correctifs nécessaires : transactions imbriquées par savepoints (le traitement d'un webhook reste atomique), contrôle des projections privées avant envoi (dont annulation d'inscription sans changement de version de la rencontre), destination privée immuable et suppression d'une réponse destinée à une communauté quittée. Dates Paris validées, y compris changements d'heure. L'interface de connexion rappelle les huit menus.

**65 tests réussis**, build et contrôle TypeScript réussis. Les nouveaux tests traversent les huit parcours via WhatsApp simulé, plus un vrai serveur HTTP local avec HMAC WAHA et adaptateur réseau substitué. Aucun téléphone réel ni message tiers utilisé. Voir WHATSAPP-COMMANDS.md et whatsapp-complete-validation.txt. La publication GitHub et le déploiement de cette version sont l'étape suivante ; aucun nouvel hébergement requis.


## WhatsApp complet v2 — publication et vérification

Source locale `f382dd992c52356a6eb283e66aca890d8e16d6b5`, publication GitHub `4d2510a66195183e5e17becb9dbf8a34023f1ace`. Déploiement Render `dep-dbr4jo95efls73dmtteg` confirmé **live**, terminé le 12 novembre 2026 à 23:22 UTC. Le service existant et ses volumes sont conservés ; aucun nouveau service ni changement de budget. Déploiements automatiques toujours désactivés.

Contrôles distants : `/health` 200 mode waha ; `/api/config` 200, assistant `whatsapp-complete-v2`, demo false ; instructions WhatsApp actualisées dans `/app.js` ; administration et statut privé refusés sans authentification. Preuves : `whatsapp-v2-live-validation.json`. Les 65 tests automatisés sont réussis.

Le statut privé WAHA indique **SCAN_QR_CODE**, connected false, personalTestReady false : le propriétaire doit encore scanner le QR depuis son lien privé puis activer son test personnel. Ensuite, `Nanba aide` dans sa discussion « Vous ». Réception, sondages, votes et identifiants LID sur téléphones réels restent à valider. Aucun message tiers envoyé. Guide détaillé : `WHATSAPP-COMMANDS.md`.


## Réparation du parcours QR — 13 novembre 2026

Adaptation du bundle de connexion WhatsApp déployée sur le service WAHA existant :
`dep-dbrjos3tqb8s73eoskp0`, live à 16:36:44 UTC. Le QR natif est de nouveau
accessible : neuf observations `SCAN_QR_CODE`, six QR distincts en presque cinq
minutes, aucun timeout constaté. L’association du téléphone et les échanges
WhatsApp restent à valider ; aucun message envoyé. Détails, code, limites de
publication GitHub et retour arrière : `WHATSAPP-LOGIN-REPAIR.md`.
