import type { Row } from "./db.ts";
export const onboardingCopy: Record<string, Row> = {
  fr: {
    welcome:
      "👋 Vanakkam ! Je suis Nanba. Choisis ta langue, tes centres d’intérêt et la façon dont tu préfères mes réponses. C’est facultatif et tout reste dans WhatsApp.\nPERSONNALISER : formulaire · QUESTIONS ICI : conversation · PLUS TARD : continuer librement.",
    personalize: "Personnaliser",
    chat: "Questions ici",
    later: "Plus tard",
    next: "Suivant",
    submit: "Vérifier mes choix",
    pages: ["Mes réponses", "Mes intérêts", "Mon assistant"],
    language: "Dans quelle langue ?",
    replyMode: "Quel format de réponse ?",
    interests: "Quels sujets t’intéressent ? (4 maximum)",
    city: "Quelle ville ? (facultatif)",
    tone: "Quel ton préfères-tu ?",
    length: "Quelle longueur de réponse ?",
    notifications: "Une sélection automatique ?",
    dailyTopics: "Quels sujets pour cette sélection ? (4 maximum)",
    at: "À quelle heure ? (HH:MM)",
    timezone: "Quel fuseau horaire ?",
    optional: "Facultatif. PASSER garde le réglage actuel.",
    hint: "Réponds par le numéro ou avec tes mots. PASSER · RETOUR · PLUS TARD",
    languages: ["Français", "English", "தமிழ்", "Tanglish"],
    formats: ["Texte", "Audio (voix IA)", "Comme mes messages"],
    tones: ["Chaleureux", "Direct", "Posé"],
    lengths: ["Court", "Détaillé"],
    notices: [
      "Aucune sélection automatique",
      "Une sélection le matin",
      "Une sélection le soir",
      "Garder mon programme actuel",
    ],
    topics: [
      "Logement",
      "Emploi",
      "Démarches et services",
      "Actualités",
      "Sorties",
      "Cinéma",
      "Cuisine",
      "Images",
      "Horoscope",
    ],
    daily: ["Actualités", "Sorties", "Cinéma", "Cuisine", "Images"],
    intro:
      "Personnalisation facultative. Tes choix seront mémorisés pour ce numéro après confirmation.",
    paused:
      "Questionnaire mis de côté. Écris QUESTIONS ICI pour le reprendre. Comment puis-je t’aider ?",
    invalid: "Je n’ai pas reconnu ce choix. Choisis un numéro ou écris PASSER.",
    review: "Voici tes choix à vérifier",
    confirm:
      "Écris CONFIRMER pour mémoriser ces choix et appliquer le programme indiqué. RETOUR pour corriger, ANNULER pour abandonner.",
    saved:
      "✅ Préférences enregistrées pour ton numéro. MON PROFIL pour les consulter ; PERSONNALISER pour les modifier ; OUBLIE pour les effacer.",
    cancelled:
      "Brouillon abandonné. Tes préférences et tes abonnements n’ont pas changé.",
    none: "Aucune sélection matin/soir. Les rappels personnels et alertes existants restent distincts.",
    keep: "Programme existant conservé. Aucun nouvel abonnement.",
    dailyNotice:
      "Une sélection par jour si du contenu pertinent est disponible. Remplace les sélections matin/soir existantes.",
    noDraft:
      "Aucun questionnaire à confirmer. Écris PERSONNALISER pour commencer.",
    stale:
      "Ce formulaire est ancien ou déjà traité. Écris PERSONNALISER pour recommencer.",
    flow: "Choisis tes préférences dans le formulaire WhatsApp, ou écris QUESTIONS ICI. Un récapitulatif sera demandé avant enregistrement.",
    footer: "Aucun abonnement sans confirmation. Modifiable avec MON PROFIL.",
    newInvite:
      "Pour adapter Nanba à tes envies, écris PERSONNALISER (facultatif).",
    timeHint:
      "Heure locale HH:MM, par exemple 08:30. Heures calmes respectées (22h–7h par défaut).",
    zoneHint:
      "France : Europe/Paris · Inde : Asia/Kolkata · ou ton fuseau IANA.",
    flowHint:
      "Sans heure ou sujets, aucun envoi activé. Fuseau par défaut : Europe/Paris. Confirmation dans la conversation.",
  },
  en: {
    welcome:
      "👋 Vanakkam! I’m Nanba. Choose your language, interests and preferred replies. Optional, entirely inside WhatsApp.\nPERSONALISE: form · QUESTIONS HERE: chat · LATER: keep chatting.",
    personalize: "Personalise",
    chat: "Questions here",
    later: "Later",
    next: "Next",
    submit: "Review my choices",
    pages: ["My replies", "My interests", "My assistant"],
    language: "Which language?",
    replyMode: "Which reply format?",
    interests: "Which topics interest you? (up to 4)",
    city: "Which town or city? (optional)",
    tone: "Which tone?",
    length: "How much detail?",
    notifications: "An automatic selection?",
    dailyTopics: "Topics for this selection? (up to 4)",
    at: "At what time? (HH:MM)",
    timezone: "Which time zone?",
    optional: "Optional. SKIP keeps the current setting.",
    hint: "Reply with a number or your own words. SKIP · BACK · LATER",
    languages: ["Français", "English", "தமிழ்", "Tanglish"],
    formats: ["Text", "Audio (AI voice)", "Match my messages"],
    tones: ["Friendly", "Direct", "Calm"],
    lengths: ["Short", "Detailed"],
    notices: [
      "No automatic selection",
      "One morning selection",
      "One evening selection",
      "Keep my current schedule",
    ],
    topics: [
      "Housing",
      "Jobs",
      "Practical help",
      "News",
      "Events",
      "Cinema",
      "Cooking",
      "Images",
      "Horoscope",
    ],
    daily: ["News", "Events", "Cinema", "Cooking", "Images"],
    intro:
      "Optional personalisation. Choices are saved for this number after confirmation.",
    paused:
      "Questionnaire paused. Write QUESTIONS HERE to resume. How can I help?",
    invalid: "I didn’t recognise that choice. Pick a number or write SKIP.",
    review: "Review your choices",
    confirm:
      "Write CONFIRM to save and apply the schedule shown. BACK to edit, CANCEL to discard.",
    saved:
      "✅ Preferences saved for your number. MY PROFILE to view; PERSONALISE to edit; OUBLIE to erase.",
    cancelled: "Draft discarded. Preferences and subscriptions are unchanged.",
    none: "No morning/evening selection. Personal reminders and existing alerts are separate.",
    keep: "Existing schedule kept. No new subscription.",
    dailyNotice:
      "One selection per day when relevant content is available. Replaces existing morning/evening selections.",
    noDraft: "No questionnaire to confirm. Write PERSONALISE to start.",
    stale:
      "This form is old or already processed. Write PERSONALISE to start again.",
    flow: "Choose preferences in the WhatsApp form, or write QUESTIONS HERE. Review a summary before saving.",
    footer: "No subscription without confirmation. Change with MY PROFILE.",
    newInvite: "To personalise Nanba, write PERSONALISE (optional).",
    timeHint:
      "Local time HH:MM, e.g. 08:30. Quiet hours apply (22:00–07:00 by default).",
    zoneHint:
      "France: Europe/Paris · India: Asia/Kolkata · or your IANA time zone.",
    flowHint:
      "No time or topics means no subscription. Default time zone: Europe/Paris. Confirm in the chat.",
  },
  ta: {
    welcome:
      "👋 வணக்கம்! நான் நண்பா. உங்கள் மொழி, விருப்பங்கள், பதில் முறையைத் தேர்ந்தெடுக்கலாம். இது கட்டாயமில்லை; அனைத்தும் WhatsApp-இலேயே.\nPERSONALISE: படிவம் · QUESTIONS HERE: உரையாடல் · LATER: பிறகு.",
    personalize: "தனிப்பயனாக்கு",
    chat: "இங்கே கேள்",
    later: "பிறகு",
    next: "அடுத்து",
    submit: "சரிபார்",
    pages: ["எனது பதில்கள்", "எனது விருப்பங்கள்", "எனது உதவியாளர்"],
    language: "எந்த மொழி?",
    replyMode: "எந்த பதில் முறை?",
    interests: "எந்தத் தலைப்புகள்? (4 வரை)",
    city: "எந்த நகரம்? (விருப்பம்)",
    tone: "எப்படிப் பேச வேண்டும்?",
    length: "எவ்வளவு விளக்கம்?",
    notifications: "தானாக ஒரு தொகுப்பு வேண்டுமா?",
    dailyTopics: "தொகுப்பின் தலைப்புகள்? (4 வரை)",
    at: "எத்தனை மணிக்கு? (HH:MM)",
    timezone: "எந்த நேர மண்டலம்?",
    optional: "கட்டாயமில்லை. SKIP: தற்போதைய அமைப்பு தொடரும்.",
    hint: "எண் அல்லது சொற்களில் பதிலளிக்கலாம். SKIP · BACK · LATER",
    languages: ["Français", "English", "தமிழ்", "Tanglish"],
    formats: ["எழுத்து", "ஒலி (AI குரல்)", "என் செய்தியைப் போல"],
    tones: ["நட்பாக", "நேரடியாக", "அமைதியாக"],
    lengths: ["சுருக்கமாக", "விரிவாக"],
    notices: [
      "தானியங்கி தொகுப்பு வேண்டாம்",
      "காலையில் ஒரு தொகுப்பு",
      "மாலையில் ஒரு தொகுப்பு",
      "தற்போதைய அட்டவணை தொடரட்டும்",
    ],
    topics: [
      "வீடு",
      "வேலை",
      "நடைமுறை உதவி",
      "செய்திகள்",
      "நிகழ்ச்சிகள்",
      "சினிமா",
      "சமையல்",
      "படங்கள்",
      "ஜாதகம்",
    ],
    daily: ["செய்திகள்", "நிகழ்ச்சிகள்", "சினிமா", "சமையல்", "படங்கள்"],
    intro:
      "இது விருப்பத் தேர்வு. உறுதிப்படுத்திய பிறகே விருப்பங்கள் சேமிக்கப்படும்.",
    paused:
      "கேள்விகள் இடைநிறுத்தப்பட்டன. தொடர QUESTIONS HERE என்று எழுதவும். என்ன உதவி வேண்டும்?",
    invalid:
      "தேர்வு புரியவில்லை. எண்ணைத் தேர்ந்தெடுக்கவும் அல்லது SKIP என்று எழுதவும்.",
    review: "உங்கள் தேர்வுகளைச் சரிபார்க்கவும்",
    confirm:
      "சேமிக்கவும் காட்டிய அட்டவணையைச் செயல்படுத்தவும் CONFIRM என்று எழுதவும். திருத்த BACK; கைவிட CANCEL.",
    saved:
      "✅ விருப்பங்கள் சேமிக்கப்பட்டன. பார்க்க MY PROFILE; மாற்ற PERSONALISE; அழிக்க OUBLIE.",
    cancelled: "வரைவு கைவிடப்பட்டது. பழைய அமைப்புகள் மாறவில்லை.",
    none: "காலை/மாலை தொகுப்பு இல்லை. தனிப்பட்ட நினைவூட்டல்கள் மற்றும் அறிவிப்புகள் தனியானவை.",
    keep: "பழைய அட்டவணை தொடரும். புதிய பதிவு இல்லை.",
    dailyNotice:
      "பொருத்தமான தகவல் இருந்தால் தினமும் ஒரு தொகுப்பு. பழைய காலை/மாலை தொகுப்புகளை மாற்றும்.",
    noDraft: "உறுதிப்படுத்த வரைவு இல்லை. PERSONALISE என்று எழுதவும்.",
    stale:
      "இந்தப் படிவம் பழையது அல்லது ஏற்கனவே முடிந்தது. PERSONALISE என்று எழுதவும்.",
    flow: "WhatsApp படிவத்தில் தேர்வு செய்யவும் அல்லது QUESTIONS HERE என்று எழுதவும். சேமிக்கும் முன் உறுதிப்படுத்த வேண்டும்.",
    footer: "உறுதிப்படுத்தாமல் பதிவு இல்லை. MY PROFILE மூலம் மாற்றலாம்.",
    newInvite: "நண்பாவைத் தனிப்பயனாக்க PERSONALISE என்று எழுதலாம் (விருப்பம்).",
    timeHint: "உள்ளூர் நேரம் HH:MM, எ.கா. 08:30. அமைதி நேரம் 22:00–07:00.",
    zoneHint:
      "பிரான்ஸ்: Europe/Paris · இந்தியா: Asia/Kolkata · அல்லது IANA நேர மண்டலம்.",
    flowHint:
      "நேரமும் தலைப்புகளும் இல்லாமல் பதிவு இல்லை. இயல்பு Europe/Paris. உரையாடலில் உறுதிப்படுத்தவும்.",
  },
};
