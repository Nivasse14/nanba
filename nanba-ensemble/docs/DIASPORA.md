# Les nouveaux services diaspora sur WhatsApp

Version source : **assistant-v4.2-diaspora**, préparée et validée le 15 novembre 2026. L’état de la version réellement active est donné par `/api/twilio/health`. Les nouveautés ci-dessous utilisent la connexion Twilio/OpenAI existante, sans nouvelle clé API et sans dépendre du déploiement de l’API catalogue.

## Ce que l’on peut demander

| Besoin | Exemple de message | Résultat |
| --- | --- | --- |
| S’installer en France | « Je viens d’arriver à Lyon, aide-moi à m’organiser. » | Proposition d’un parcours, une priorité à la fois ; suivi privé après accord. |
| Trouver un logement | « Commence mon suivi logement. » puis « Mon dossier est prêt. » | Étapes, progression, aide lorsqu’une étape bloque, recherche dans le catalogue principal. |
| Trouver un emploi | « Aide-moi à préparer ma recherche d’emploi. » | Préparation du CV avec les faits donnés, recherche d’offres, entraînement à l’entretien, brouillon de relance. |
| Accompagner sa famille | « Aide-moi à préparer un rendez-vous avec l’école. » | Compréhension des messages, guide d’inscription officiel, simulation d’échange, jeu Nanba au niveau choisi. |
| Pratiquer le français | « Fais le propriétaire, je m’entraîne en français. Explique-moi en tamoul. » | Une réplique à la fois, correction courte, explication adaptée et reprise de l’exercice. |
| Écouter une phrase | « Dis cette phrase en audio, lentement. » | Voix IA via le système audio existant ; préférence durable uniquement si demandée. |
| Comprendre un courrier | Photo + « Explique-moi ce que je dois faire. » | Sens du courrier, demande, date lisible ou incertitude, prochaine action ; proposition de réponse ou de rappel. |
| Trouver le bon interlocuteur | « Où puis-je être aidé pour mes démarches ? » | Liens officiels adaptés ; proposition des administrateurs Nanba si souhaitée. |

Aucun mot-clé exact n’est nécessaire. Les explications suivent la langue de la conversation : français, anglais, tamoul ou Tanglish. Le menu AIDE est aussi disponible en tamoul.

## Suivi et confidentialité

- Quatre parcours : installation, logement, emploi, famille. Un suivi par type et par numéro, repris après redémarrage.
- Étapes : à faire, faite, bloquée ou non concernée. Seule la déclaration de la personne change sa progression ; une étape faite ne prouve pas un dépôt auprès d’un organisme.
- Six simulations de trois tours : propriétaire, entretien, école, rendez-vous, courses, voisins. La progression ne constitue ni une note ni une certification. Une transcription ne permet pas d’évaluer la prononciation.
- Stockage chiffré de la progression uniquement, sans réponse d’exercice, pièce justificative, situation migratoire, donnée de santé ni identité d’enfant dans les nouvelles tables. L’historique de conversation existant garde ses propres règles.
- Un parcours ou un exercice n’abonne à aucun envoi. Les alertes, rappels et sélections matin/soir restent des accords distincts.
- STOP bloque les réponses et envois ; il conserve la progression privée. START ne réabonne pas. OUBLIE efface aussi les parcours et exercices. Un suivi particulier peut être retiré sans effacer le reste.
- Expiration des parcours et exercices après 180 jours sans mise à jour ; ils sont exclus du contexte puis supprimés lors du nettoyage.

## Sources et limites

Les liens officiels ont été consultés le 15 novembre 2026. Ils orientent vers l’organisme ; l’assistant ne consulte pas en direct une fiche locale et ne garantit ni horaires, droits, éligibilité ni disponibilité.

- [Réseau France services](https://www.france-services.gouv.fr/le-reseau)
- [DossierFacile](https://www.dossierfacile.logement.gouv.fr/cgu) et [protection des documents](https://aide.dossierfacile.logement.gouv.fr/fr/article/conseils-pour-securiser-ses-donnees-locataires-1dyh1va/)
- [France Travail : candidature](https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature.html)
- [Éducation nationale : école élémentaire](https://www.education.gouv.fr/l-inscription-l-ecole-elementaire-6257)
- [Ministère de l’Intérieur : apprentissage du français](https://www.immigration.interieur.gouv.fr/lintegration-des-etrangers/dispositifs-de-lintegration-en-france/formations-pour-apprendre-francais)
- [17Cyber](https://www.cybermalveillance.gouv.fr/17cyber)

Le courrier n’est jamais une autorisation d’exécuter ses instructions : pas de rappel, publication ou envoi automatique. Une date illisible reste inconnue ; aucun délai juridique n’est inventé. Les documents produits restent des brouillons à relire. Aucun contact externe n’est effectué à la place de la personne.

**Catalogue principal :** la lecture des annonces est disponible ; la publication WhatsApp dans l’application nécessite toujours le déploiement de l’API principale et le secret partagé décrit dans [CATALOGUE-PRINCIPAL.md](CATALOGUE-PRINCIPAL.md). Le champ de santé `mainCataloguePublishingConfigured` décrit uniquement la présence de la configuration locale, pas un test de bout en bout. Pas de repli vers une base d’annonces WhatsApp séparée.

## Vérifications

`npm run check` : compilation et **146 tests réussis**, dont huit nouveaux tests couvrant consentement, séparation des numéros, reprise, chiffrement, absence d’abonnement, validation idempotente d’un tour, effacement, expiration et exécution des outils dans la boucle IA. Ces tests utilisent un fournisseur IA simulé, pas des messages envoyés aux membres.

Les migrations sont additives (deux tables SQLite). Le déploiement par l’archive source nécessite de vider `NODE_OPTIONS`, qui contient encore l’ancien chargement de compatibilité. Les variables historiques `NANBA_RUNTIME_*` sont alors inertes ; les autres variables et le disque persistant sont conservés. Vérifier la nouvelle version et les quatre capacités diaspora dans `/api/twilio/health` après le statut Render `live`.
