# Offres, demandes et alertes du catalogue principal

État : prêt et testé localement, PAS ACTIVÉ EN PRODUCTION au 14 novembre 2026. L'API principale doit d'abord être déployée sur Google Cloud. La console affiche « Site unavailable » depuis l'environnement de travail. L'assistant actuellement en production reste la version précédente.

## Ce qui change

- `nanba-catalogue.ts` relie les publications au catalogue Nanba principal. Une annonce passe par brouillon, confirmation explicite et reçu du serveur. Un statut `moderation` n'est jamais annoncé comme déjà visible. Les anciennes offres locales restent contactables, mais aucune nouvelle publication ne reste dans un catalogue WhatsApp séparé.
- Recherche naturelle : catégorie, sens offre/demande, zones acceptées, budget, type et contrat sont structurés. Le texte libre ordonne les candidats sans imposer la présence exacte de mots. Le modèle choisit les pistes pertinentes et pose une question lorsque la zone ou un critère essentiel manque. Un élargissement exige l'accord de la personne.
- Les recherches à surveiller sont privées, chiffrées par numéro et distinctes d'une annonce publique. Consentement obligatoire, cinq recherches actives maximum, contrôle périodique environ toutes les cinq minutes. La sélection combine critères impératifs et comparaison sémantique IA ; elle ne décide jamais de l'attribution d'un logement ou d'un emploi.
- Les notifications partagent les préférences de tranquillité et le plafond des sélections : deux maximum par jour par défaut, quatre heures d'écart, silence 22 h–7 h, pause après 14 jours d'inactivité. PAUSE, STOP et la suppression d'une recherche empêchent les envois. Les identifiants déjà proposés ne sont pas renvoyés ; les annonces retirées sont revérifiées avant livraison. Les modèles WhatsApp approuvés restent nécessaires hors conversation récente.
- Les réponses IA et les alertes utilisent le budget journalier existant. Une panne de l'IA ou du catalogue n'invente ni correspondance ni publication.
- La mise en relation se fonde sur le propriétaire réel de l'annonce du catalogue, avec demande puis acceptation avant échange des numéros.

## Exemples de recette après déploiement

1. « Je propose une chambre à Sevran, 500 euros charges comprises, disponible maintenant. » L'assistant complète les faits manquants, montre le brouillon puis attend l'accord public.
2. « Je cherche un logement. » Il pose une question utile ou propose une zone présente dans le catalogue ; aucune alerte ni publication automatique.
3. « Préviens-moi si une chambre à moins de 550 euros arrive à Sevran. » Il demande seulement les critères essentiels manquants puis enregistre l'alerte avec accord.
4. « Je cherche un travail en cuisine en région parisienne. » Il comprend l'intention sans exiger un mot-clé exact et demande avant tout élargissement.
5. « Je vends un vélo à Paris pour 80 euros » / « Publie que je recherche un vélo à Paris ». Offre et demande restent distinguées dans le catalogue et l'application.
6. « Mes recherches », « arrête cette alerte », « retire mon annonce », « je veux être mis en relation pour cette référence ».

## Activation

Le même secret serveur `NANBA_WHATSAPP_CATALOGUE_SECRET` doit être configuré sur Cloud Run et Render. Les identités proviennent des messages Twilio authentifiés, pas du modèle. Le secret et les bases membres ne figurent jamais dans les sources.

Le correctif de l'application principale est fourni dans `integrations/nanba-app-catalogue.patch` et dans le dépôt source Nanba. Son guide `docs/WHATSAPP-CATALOGUE.md` donne les cibles et l'ordre de déploiement. Ne pas activer uniquement la partie WhatsApp en annonçant une connexion au catalogue qui n'aurait pas été déployée.

Validation : compilation et construction réussies, 138 tests assistant réussis, dont 6 nouveaux scénarios catalogue ; tests API et régressions du catalogue principal réussis. Aucun message réel envoyé, aucune fausse annonce publiée dans la base de production. La conversation avec le modèle réel et la validation visuelle restent à recetter après déploiement.
