## Horoscope WhatsApp — parcours naissance (v4.1)

Le membre dit « Mon horoscope ». L’assistant demande la date de naissance, puis la ville et le pays, et l’heure locale si elle est connue. Les champs techniques ne sont plus demandés. L’heure peut être inconnue ou approximative ; une heure inconnue n’est pas remplacée par midi. Les données sont enregistrées chiffrées par numéro, corrigibles avec `horoscope_update`, supprimables avec `horoscope_forget` (profil astrologique) ou `OUBLIE` (mémoire et historique complets).

Le calcul réutilise le moteur Lahiri de l’application Nanba (`indian-astrology.js`) avec Astronomy Engine 2.1.19, sous licence MIT. Recherche de lieux : API publique Nanba `/locations/birth-place`, données GeoNames (CC BY 4.0). Seule la ville est envoyée à cette API, pas la date ou l’heure de naissance. Aucun accès au compte privé d’un autre membre. Les homonymes demandent une précision ; seuls les identifiants proposés pour ce numéro peuvent être sélectionnés. Le fuseau historique du lieu est utilisé indépendamment de la résidence et du fuseau des rappels.

Le moteur déduit le Rasi lunaire, Nakshatra et pada ; avec une heure connue, il fournit aussi le signe solaire indien et occidental. Les frontières proches sont signalées et les champs incertains omis. Les heures ambiguës/inexistantes au changement d’heure demandent une vérification. Sans heure : seuls les éléments stables sur toute la journée locale sont conservés. Avec une heure explicitement approximative : marge conservatrice ±2 h, annoncée comme telle, sans couvrir une incertitude plus grande. Ascendant, dashas et prévisions personnelles ne sont pas implémentés.

Les sélections quotidiennes utilisent les positions du jour à 12 h en Inde (même repère que l’application), une clé de déduplication par date, et distinguent ces repères des interprétations culturelles. Aucun nouvel abonnement n’est créé pendant ce parcours. Les règles de consentement, horaires, pause et modèles Meta existantes restent applicables.

Vérifications : trois références natales indépendantes publiées par Prokerala, fuseaux été/hiver, dates invalides, heure inconnue/approximative, villes homonymes, séparation des numéros, correction et effacement, annulation `OUBLIE` pendant une requête. Diagnostic privé `mode=horoscope` : conversation IA réelle avec identité de test en base temporaire, aucun message Twilio réel.

Sources techniques : https://github.com/cosinekitty/astronomy ; https://www.astro.com/swisseph/swisseph.htm (ancrage Lahiri, aucun code Swiss Ephemeris repris) ; https://api.prokerala.com/reports/sample/single-page-horoscope-en.pdf ; https://api.prokerala.com/reports/sample/porutham-kerala-en.pdf ; https://www.geonames.org/.

---

# Assistant WhatsApp Nanba — version 4

## Nouvelles possibilités

Les services publics de l’application Nanba sont désormais accessibles par un outil borné : actualités, annonces logement/emploi/services/événements, cinéma en streaming (France par défaut, JustWatch/TMDB), cartes et sourires par liens sources, EUR/INR et EUR/LKR datés, voyages en cache, orientations emploi, catalogue de formations, jeu quotidien, débat et cuisine. Une réponse vide ou un service indisponible reste présenté comme tel. Le cinéma suit les plateformes et l’industrie choisies. Les formations demandent un métier issu de l’API emploi ; les intentions annuelles de recrutement ne sont jamais présentées comme des postes à pourvoir.

Exemples WhatsApp :

- « Retiens que je suis à Sevran, que je regarde les films tamouls sur Netflix en France. »
- « Tous les matins à 8 h, les nouvelles de l’Inde et une image de famille. Tous les soirs à 20 h, un film et une idée cuisine. Heure de Paris. »
- « Seulement du lundi au vendredi. » / « Je ne veux plus de cinéma. »
- « Montre-moi un aperçu de ma sélection du soir, sans m’abonner. »
- « Quels films tamouls sont sur Netflix en France ? »
- « Quel est le dernier taux euro/roupie publié ? »
- « Quels métiers recrutent dans le 93 ? Puis montre-moi des formations cuisine. »
- « Un petit jeu de culture indienne pour ma fille en CE2. »
- « MON PROGRAMME » / « PAUSE 7 JOURS » / « REPRENDRE » / « MOINS ».
- « Parle-moi du film que tu viens de m’envoyer. » Le contexte reprend la dernière sélection effectivement envoyée, durant 48 h.

## Matin, soir et traitement de fond

Aucun abonnement implicite. `routine_set` exige un accord explicite et un ou deux créneaux ; chaque créneau peut avoir ses propres thèmes (1–4). Cette opération remplace le programme matin/soir du numéro concerné. Les autres rappels restent actifs. Le profil reste chiffré et séparé par identité WhatsApp.

Deux sélections maximum par jour et quatre heures minimum entre sélections ; `MOINS` ramène à une. Silence de 22 h à 7 h par défaut, réglable. Les jours et le fuseau sont personnalisables avec prise en compte de l’heure d’été. Les sélections sont suspendues après 14 jours sans message entrant et pendant une prise en charge humaine. `PAUSE` laisse les rappels personnels actifs ; `STOP` annule tous les envois futurs, `START` ne réabonne pas. `OUBLIE` supprime aussi les préférences de programme et traces de déduplication personnelles.

Le traitement utilise la file SQLite persistante du service Render existant : une occurrence à la fois, priorité aux réponses interactives, identifiant d’occurrence déterministe, transaction atomique d’enfilement et de progression du calendrier. Les sélections comportent au plus trois sections et 840 caractères, sans troncature des URL. Elles n’appellent pas de modèle IA pour leur composition textuelle ; la synthèse vocale, si choisie et disponible dans la fenêtre WhatsApp, reste soumise au budget existant. Les lectures publiques sont mises en cache et mutualisées entre personnes, sans identifiant utilisateur envoyé aux API publiques. Les recherches de vols ne déclenchent pas de rafraîchissement SerpAPI payant.

Les contenus déjà proposés ne sont pas répétés pendant quatorze jours ; seuls les contenus disponibles et nouveaux sont envoyés. Une panne API n’envoie pas de notification de panne au membre. Les sélections retardées de plus de deux heures sont abandonnées ; pas de rattrapage du message du matin le soir. Les rappels personnels conservent leur fenêtre existante. Les préférences sont revérifiées après récupération des données et avant livraison, y compris pour les pièces jointes vocales.

La configuration privée `/twilio` expose les tâches actives, services connectés et statuts de modèles. Le diagnostic privé `mode=routines` exerce le vrai modèle et des API réelles dans une base en mémoire, intercepte tous les messages Twilio et vérifie deux créneaux distincts, la pause et un aperçu. Il ne crée aucun abonnement réel.

## Limites vérifiées

La confirmation d’un abonnement ajoute côté serveur la mention de l’attente Meta, même si le modèle IA l’omet.

Au contrôle du 14 novembre 2026, les douze modèles Twilio/Meta sont encore `pending`. Les conversations récentes fonctionnent ; les envois proactifs hors fenêtre de 23 h conservatrice attendent une approbation réelle. Ils ne contournent jamais la fenêtre WhatsApp et les sélections périmées sont abandonnées.

L’horoscope natal personnel, les votes publics, les classements et les publications dans l’application principale nécessitent une session Nanba du membre : l’association sécurisée entre ce compte et le numéro WhatsApp n’est pas encore fournie. L’assistant oriente vers l’application ; il ne réutilise pas la session d’un administrateur. Les échanges privés sur un débat et les jeux conversationnels ne publient rien dans les classements. L’horoscope disponible ici reste symbolique.

Les images jointes restent les créations autorisées déjà importées. Les médias externes sont présentés par lien vers leur créateur. La cotation de l’or de l’API principale porte une restriction de redistribution : elle n’est pas recopiée dans WhatsApp. Les taux EUR/INR et EUR/LKR restent des références datées, pas des prix de transfert. Le catalogue de formations et la cuisine peuvent être vides ; aucune donnée n’est inventée. Le quota IA journalier existant est conservé.

Validation : build, types et 124 tests réussis, puis les mêmes 124 tests sur la source exacte de production chargée par le preload vérifié. Les nouveaux tests couvrent consentement, remplacement et isolation des programmes, personnalisation des créneaux, persistance et déduplication, silence, plafond, pause, priorités, concurrence avec OUBLIE, expiration en attente de Meta, contrats API et absence de rafraîchissement payant. Le paquet de déploiement est compressé en Brotli (environ 1,23 Mo), avec nettoyage des segments d’environnement inutilisés. Déploiement et contrôle réel consignés dans `assistant-v4-live-validation.json`.

---

# Nanba sur WhatsApp — compagnon personnel

Cette version étend le pilote Twilio existant. Le texte, les vocaux transcrits et les photos entrantes restent pris en charge. Les réponses peuvent maintenant joindre les images originales sélectionnées par le propriétaire.

## À tester dans WhatsApp

- « Appelle-moi Arun, j’ai 65 ans. Retiens que je préfère des réponses courtes en tamoul. »
- « Qu’est-ce que tu sais de moi ? » / « Oublie mon âge. »
- « Rappelle-moi demain à 9 h de préparer mon dossier. »
- « Tous les lundis à 18 h, rappelle-moi de vérifier mes démarches. »
- « Tous les matins à 8 h, envoie une image de famille et trois nouvelles de l’Inde. »
- « Mon Rasi est Meena. Chaque matin à 8 h 15, donne-moi une lecture symbolique. »
- « Donne-moi les dernières nouvelles du Tamil Nadu. »
- « Envoie-moi une image pour souhaiter une bonne journée. »
- « Préviens-moi chaque jour à 18 h s’il y a une nouvelle chambre à Paris à moins de 500 €. »
- « Publie une offre d’entraide : je peux traduire un courrier à Paris. »
- « Trouve quelqu’un qui aide à traduire à Paris. » Puis demande explicite de contact et acceptation par l’autre membre.
- « Mes rappels » / « Annule mon rappel [référence] » / « Annule tous mes rappels ».
- « STOP » annule tous les envois futurs et suspend les réponses. « START » reprend le dialogue sans réabonner.
- « OUBLIE » efface profil, historique local, rappels, abonnements et offres. Les messages déjà présents dans WhatsApp ne sont pas supprimés.

## Comportement livré

Le profil chiffré est isolé par numéro et expéditeur Twilio. Il contient les informations explicitement déclarées et utiles, avec langue, ton, âge facultatif, ville, préférences d’image, Rasi/Nakshatram et faits courts. Le style courant guide aussi la réponse sans deviner l’âge. L’historique court reste limité à douze messages et sept jours ; le profil durable survit aux redémarrages et au nettoyage de cet historique.

Les tâches sont persistées sur le disque SQLite de Render. Le planificateur fonctionne dans le service existant et reprend après un redémarrage. Dates locales et fuseaux IANA sont vérifiés ; Europe/Paris est le défaut. Les heures inexistantes ou ambiguës lors d’un changement d’heure demandent une précision. Les abonnements quotidiens gardent l’heure locale ; une plage quotidienne inexistante est sautée. Les horaires hebdomadaires utilisent les jours sélectionnés.

Les envois s’effectuent au prochain passage disponible du worker, habituellement à la seconde près hors traitement IA. Une génération en cours peut les décaler de quelques dizaines de secondes. Une interruption n’entraîne jamais une double relance aveugle d’un envoi dont le résultat est inconnu. Les occurrences manquées de plus d’un jour sont abandonnées ; les abonnements reprennent à la prochaine occurrence.

Après 23 heures sans message entrant (marge conservatrice sur la fenêtre WhatsApp de 24 h), seules les notifications avec un modèle approuvé sont envoyées. Modèles français, anglais et tamoul : rappel demandé (utility), rendez-vous éditorial et image (marketing). Les modèles réellement approuvés sont vérifiés auprès de Twilio, jamais supposés valides. En attente d’approbation, le message attend jusqu’à un jour maximum. Aucun message libre n’est utilisé pour contourner cette règle.

La collection comprend les images originales de famille déjà générées, plus les visuels Happy Friday qui sont limités au vendredi. Les images spirituelles exigent un choix explicite. Les visuels financiers datés ne sont pas recyclés en cours actuels. Les fichiers sont conservés sur le disque du pilote et servis par leur empreinte publique, uniquement pour les images de partage choisies. Aucune photo reçue d’un membre n’est ajoutée à cette collection. Il s’agit d’une rotation de la collection, pas d’une nouvelle génération d’image chaque matin.

Les actualités viennent de l’API réelle de Nanba : `/news/top-stories`, avec repli sur `/news`. Les articles de plus de trois jours et les liens non HTTP(S) sont exclus. Les titres, sources, dates et liens originaux alimentent le résumé ; aucun accès arbitraire aux URL fournies par un membre. Les liens restent ceux des éditeurs. Le catalogue `/listings` fournit les annonces ; la recherche peut être vide. Les alertes comparent les identifiants aux annonces déjà vues au rythme quotidien choisi. Il n’y a pas de surveillance générale d’événements privés ou de conditions externes non connectées.

L’horoscope WhatsApp est une lecture symbolique IA selon le Rasi déclaré, clairement présentée comme divertissement. L’API d’horoscope personnel de l’application principale nécessite la session du membre ; cette version ne réutilise pas la session d’un autre utilisateur et ne calcule pas de thème astral ni de positions planétaires.

Les offres d’entraide WhatsApp sont volontairement publiées dans le pilote pour trente jours. Elles restent séparées du profil privé. Aucun numéro n’apparaît dans les résultats de recherche. Une demande explicite puis l’acceptation du propriétaire déclenchent l’échange des coordonnées. Elles ne sont pas automatiquement publiées dans le catalogue principal de l’application.

## Vérification et exploitation

105 tests automatisés couvrent les fonctionnalités existantes et nouvelles, dont isolation/chiffrement, effacement, changements d’heure, idempotence des rappels, vrais statuts de modèles, pièces jointes sortantes, filtrage des flux périmés, fonction OpenAI et double consentement des contacts. Les mêmes tests s’exécutent sur la source exacte utilisée en production avec le preload vérifié par empreinte.

`POST /api/twilio/diagnostic`, protégé par le secret de configuration, réalise une conversation fictive avec le vrai modèle. Le stockage est isolé en mémoire et tout envoi WhatsApp est intercepté. Les appels IA consomment le budget global normal. Le résultat indique si le profil et le rappel ont réellement été créés dans cette simulation.

`POST /api/twilio/image-upload` importe les images choisies (PNG/JPEG, 4 Mio maximum) avec métadonnées vérifiées. `POST /api/twilio/templates` crée/soumet les modèles et vérifie leur état. Ces routes exigent le secret privé, ne permettent pas un envoi arbitraire à un destinataire. Le script `scripts/companion-admin-check.py` lit ce secret sur une entrée sans écho et ne le conserve pas.

Le déploiement conserve l’expéditeur WhatsApp et le routage du Messaging Service déjà réparés. La mise à jour concerne le bootstrap `NODE_OPTIONS` et les variables de payload `NANBA_RUNTIME_*` du service pilote : aucun secret ni autre paramètre n’est remplacé. Le code compilé est reproductible via `scripts/build-twilio-preload.mjs`. Les écritures GitHub restent indisponibles dans cette session ; les sources canoniques et le commit local doivent être synchronisés avant de retirer le preload. Le retour arrière consiste à rétablir le payload précédent ; les migrations ajoutent uniquement des tables et colonnes.

## Réponses audio, lettres et équipe humaine — version 3

Chaque personne peut écrire « Réponds en audio », « texte et audio », « en texte uniquement » ou « réponds dans le même format que moi ». Les préférences `replyMode` (text/audio/both/auto) et `voicePace` (normal/slow) sont mémorisées par numéro. Les commandes MODE TEXTE, MODE AUDIO, MODE LES DEUX et MODE AUTO fonctionnent sans appel au modèle. Le défaut reste texte ; l’âge n’active pas l’audio. En mode auto, un vocal entrant obtient une réponse audio. Les liens restent accompagnés d’un texte cliquable.

La voix synthétique s’identifie comme voix IA. Elle utilise Realtime et un encodage MP3 côté serveur, sans dépendance à ffmpeg en production. Une indisponibilité ou une limite de budget entraîne une réponse écrite. La qualité du tamoul doit être appréciée par les utilisateurs. Les pièces audio et PDF sont envoyées séparément des textes, sans légende incompatible avec WhatsApp et uniquement dans la fenêtre de conversation. Les notifications hors fenêtre continuent de nécessiter les modèles approuvés.

« Rédige une lettre à mon propriétaire en PDF », « Fais un document récapitulatif » et « Modifie le dernier courrier » utilisent les outils documentaires. Les données essentielles manquantes sont demandées, ou des champs à compléter restent explicites. Les PDF français, anglais et tamouls sont paginés, limités à dix pages et dix documents par jour/personne. Aucun courrier n’est expédié à son destinataire et aucune signature manuscrite n’est fabriquée. Les fichiers sont chiffrés et accessibles à Twilio par une URL aléatoire valable 72 heures ; le contenu éditable reste sept jours. OUBLIE révoque les liens et supprime ces données.

« Je veux parler à l’équipe Nanba » ouvre une demande suivie. L’ancien historique n’est pas transféré ; un résumé précis n’est partagé qu’avec accord. Les nouveaux textes, photos et transcriptions des vocaux de cette discussion sont ensuite destinés à l’équipe humaine, jusqu’à REPRENDRE IA. L’IA peut d’abord chercher les annonces de services et les offres communautaires réelles. Elle ne fabrique ni coordonnées ni qualifications professionnelles.

Les administrateurs sont associés à une identité propriétaire déjà vérifiée, ou via un code privé à usage unique valable dix minutes depuis `/twilio`. Un message affirmant être administrateur ne donne aucun accès. Commandes :

- ADMIN DEMANDES
- ADMIN LIRE NXXXXXXXX (ajouter un numéro de page pour la suite)
- ADMIN PRENDRE NXXXXXXXX
- ADMIN REPONDRE NXXXXXXXX votre message (650 caractères maximum par réponse)
- ADMIN TERMINER NXXXXXXXX

Une réponse humaine porte la mention « Équipe humaine Nanba ». La disponibilité n’est pas garantie. Les demandes et leurs échanges sont conservés trente jours maximum et effacés par OUBLIE. STOP ferme la demande et annule les notifications en attente. Les notifications de suivi utilisent des modèles support fr/en/ta, soumis à l’approbation WhatsApp.

Le diagnostic privé `POST /api/twilio/diagnostic?mode=features` exerce le vrai modèle et la vraie voix dans une base temporaire, intercepte tous les envois Twilio et restitue seulement des fichiers fictifs pour contrôle. Le déploiement utilise désormais un bootstrap court et un payload compressé réparti entre `NANBA_RUNTIME_XX`, vérifié par SHA-256 ; les accès fournisseurs restent inchangés. `scripts/build-twilio-preload.mjs` reconstruit le payload et son environnement. Polices Noto sous OFL dans `assets/fonts`, bibliothèques PDF et encodeur déclarés dans le verrou npm.

### Correctif des demandes audio ponctuelles

Une demande comme « Envoie-moi un audio » déclenche désormais une réponse vocale pour ce message, même si le format enregistré est texte. L’action `reply_audio` est disponible pour les formulations libres et les autres langues ; les demandes françaises/anglaises directes sont également reconnues avant la génération. Les négations, citations et demandes de traduction ne déclenchent pas cette reconnaissance automatique. Les préférences durables restent inchangées. Les anciennes déclarations d’impossibilité de l’assistant dans son historique sont explicitement obsolètes. Les échecs de synthèse sont désormais distingués dans le diagnostic privé, sans afficher les conversations.

108 tests passent sur les sources canoniques et sur la source exacte de production. Le diagnostic privé `mode=voice` teste une demande ponctuelle en tamoul après une ancienne réponse de refus, sans envoi réel à un membre.

### Lecture et indicateur de préparation

`TWILIO_PRESENCE_ENABLED=true` active l’API publique Twilio V3 Typing Indicators : le message entrant est marqué comme lu et WhatsApp affiche l’indicateur « écrit… ». L’appel part après l’accusé HTTP du webhook signé ; il ne ralentit pas cet accusé et son échec ne bloque pas la réponse. Pendant le traitement, un renouvellement borné intervient toutes les vingt secondes, puis s’arrête en fin de traitement. Aucun indicateur pour un message ignoré, arrêté, annulé, terminé, ancien ou une notification synthétique. Les répétitions du webhook sont dédupliquées.

Le statut « lu » indique la prise en compte par Nanba, pas la lecture par un administrateur humain. Les diagnostics fictifs désactivent les indicateurs. Le diagnostic privé `mode=presence` vérifie l’accès au point d’entrée Twilio par une requête sans identifiant de message : il ne peut pas notifier un membre. Les réactions emoji attachées aux messages ne sont pas proposées par l’intégration actuelle ; aucune API Twilio publique correspondante n’a été trouvée dans la documentation consultée. Aucun message supplémentaire d’accusé avec emoji n’a été ajouté.

Référence officielle : https://www.twilio.com/docs/whatsapp/api/typing-indicators-resource (consultée le 13 novembre 2026). 112 tests passent, dont les doublons, les retraits de consentement et les erreurs non bloquantes de l’indicateur.
