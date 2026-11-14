# Assistant WhatsApp Twilio + IA

L'assistant conversationnel Twilio est indépendant du transport communautaire WAHA existant. Il répond aux messages privés texte, aux vocaux et aux images, sans préfixe « Nanba », en français, anglais, tamoul ou Tanglish. Il utilise OpenAI Responses, sans recherche Internet ni actions dans les modules métier Nanba. Les réponses restent écrites. Les images sont analysées avec leur légende ; les vocaux sont transcrits avant la réponse conversationnelle.

## Activation

Le 13 novembre 2026, le numéro WhatsApp Business `+1 269 404 3536` a remplacé le Sandbox dans la configuration privée active, après autorisation explicite de l'utilisateur. Le sender est en ligne, le webhook entrant POST a été relu après modification et la génération OpenAI de vérification a réussi. Le nom public du profil reste `IA Photobooth`. Le premier échange réel et sa livraison restent à confirmer ; voir `twilio-business-activation.json`. La configuration chiffrée persistante prévaut sur le numéro Sandbox encore présent dans les variables d'environnement de secours.

Ouvrir `/twilio` et utiliser le lien privé Nanba existant (ou une session administrateur). Renseigner Twilio Account SID, Auth Token, numéro WhatsApp/Sandbox et clé API OpenAI. La page vérifie le compte Twilio actif, l'accès au modèle et une petite génération réelle avant d'enregistrer les clés chiffrées sur le disque persistant.

Configurer dans Twilio **When a message comes in**, méthode POST :
`https://nanba-ensemble-pilot-ufgg.onrender.com/api/webhooks/twilio`

Si le numéro appartient à un Messaging Service, vérifier également son routage entrant. Le service `PhotoboothFinalMessage` contenait uniquement le numéro Nanba et aucune URL entrante. Le 13 novembre 2026, son `InboundRequestUrl` a été renseigné avec le webhook ci-dessus, `InboundMethod=POST` et `UseInboundWebhookOnNumber=false`. Le message réel resté sans réponse a ensuite été rejoué avec son MessageSid original ; l'assistant a généré une réponse et Twilio a confirmé sa livraison, également reçue par callback signé. Un nouveau message entrant directement après cette correction reste à vérifier. Détails sans contenu de conversation ni numéro personnel : `twilio-delivery-repair.json`.

Pour un Sandbox, le téléphone doit rejoindre le Sandbox avec le code fourni dans la console Twilio. Ensuite écrire au numéro Twilio. Il ne s'agit pas d'un appareil lié par QR, ni du groupe WhatsApp existant.

Variables d'environnement alternatives : `TWILIO_AI_ENABLED=true`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM=whatsapp:+...`, `OPENAI_API_KEY`, `OPENAI_MODEL` (défaut `gpt-5.6-terra`). La configuration privée enregistrée prévaut sur ces variables. `IDENTITY_ENCRYPTION_KEY` doit rester stable. Aucun secret n'est renvoyé par l'API de statut.

## Fonctionnement et limites

- Signature Twilio vérifiée par le SDK officiel sur l'URL publique exacte et le formulaire brut ; compte et destinataire vérifiés.
- Accusé TwiML immédiat ; file SQLite persistante puis appel IA et réponse REST à l'expéditeur authentifié uniquement.
- Identité cloisonnée par compte, numéro Twilio et expéditeur. Numéros, contenus, mémoire et clés sont chiffrés au repos. Les fournisseurs traitent les échanges pour répondre ; `store:false` est envoyé à OpenAI.
- Doublons MessageSid ignorés. Un envoi ambigu n'est jamais réémis automatiquement. Les callbacks signés peuvent confirmer la livraison.
- Mémoire limitée aux 12 derniers éléments et purgée après 7 jours lors du nettoyage horaire. `OUBLIE` efface immédiatement la mémoire locale et annule les réponses en attente ; `STOP` suspend et `START` réactive.
- 20 appels IA/personne/jour et 50 appels IA/jour au total par défaut (réglage global de 1 à 500). Un vocal réserve un appel de transcription et un appel de réponse ; une image utilise un appel de réponse. Le budget complet est réservé avant de télécharger les pièces jointes. Cela limite les appels, pas la facture exacte. Twilio et OpenAI restent facturés à l'usage. Une génération de vérification est faite à chaque enregistrement.
- Les messages ayant attendu plus de 23 heures ne déclenchent aucun envoi. Les réponses IA échouées ont un message d'indisponibilité explicite.
- Le numéro doit être autorisé dans Twilio. La vérification du compte ne garantit pas que le sender WhatsApp soit enregistré ; la livraison réelle doit être confirmée après activation.

## Validation et exploitation

`npm run check` : compilation TypeScript et tests, incluant signature officielle, HTTP réel local, isolation, effacement pendant génération, doublons, reprise, budget et absence de secrets dans le contexte IA. Les appels fournisseurs sont simulés dans les tests ; ils ne constituent pas une validation Twilio/OpenAI réelle.

`GET /api/twilio/health` expose uniquement la présence du module et son état de configuration. Le statut privé `/api/twilio/setup` expose les compteurs et la livraison du dernier message. Aucun message réel n'est envoyé pour les tests automatiques.

Si GitHub refuse l'écriture, `node scripts/build-twilio-preload.mjs` produit un module temporaire de déploiement. Il embarque le SDK de signature officiel et les sources compilées, conserve les correctifs WAHA précédents, vérifie les empreintes exactes des sources du pilote avant remplacement et échoue si elles divergent. Il se charge via `NODE_OPTIONS=--import=data:text/javascript;base64,...`. Aucun secret n'y figure. Retirer ce mécanisme une fois l'archive source canonique mise à jour dans GitHub ; ne pas modifier les sources du pilote en laissant une ancienne empreinte.

Sans clés et webhook Twilio configurés, le module reste inactif. Le contrôle final attendu est : message WhatsApp reçu, génération IA réelle, MessageSid sortant puis callback livré/lu.

## Images et vocaux

- Formats image : JPEG, PNG, WebP (5 Mo maximum chacun). Formats audio : OGG/Opus WhatsApp, MP3, MP4/M4A, WAV, WebM, FLAC (16 Mo chacun). Maximum 4 fichiers et 20 Mo par message ; les autres fichiers reçoivent une explication.
- Transcription via `/v1/audio/transcriptions`, modèle `gpt-transcribe` (modifiable avec `OPENAI_TRANSCRIPTION_MODEL`). Pas de conversion audio locale requise.
- Signature du formulaire et correspondance du compte/numéro vérifiées avant enregistrement. URL média limitée à la ressource Twilio du compte et du MessageSid reçus. Téléchargement authentifié borné en taille et en temps ; redirections HTTPS limitées au CDN Twilio, sans transmission des identifiants. Type MIME et signature binaire vérifiés.
- Références médias chiffrées dans la file persistante, puis retirées après traitement. Octets images/audio uniquement en mémoire ; pas de fichiers temporaires sur le serveur. Historique chiffré : transcription ou légende/mention d’image, jamais les octets ni les URL privées. Les images anciennes doivent être renvoyées pour réexaminer un détail. La rétention des fichiers chez Twilio est indépendante.
- STOP/OUBLIE écrits annulent aussi les médias en attente ou en cours ; après une annulation aucun nouvel appel IA ni envoi n’est lancé. Un appel fournisseur déjà parti peut finir, mais sa réponse est abandonnée.
- Les erreurs de récupération/transcription et les dépassements restent explicites, y compris après confirmation de livraison. Le suivi des budgets compte les tentatives réservées, y compris si le téléchargement ou le fournisseur échoue.
