import React, { useMemo, useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

const departments = ['75', '92', '93', '94', '77', '78', '91', '95'];
const typeOptions = ['studio', 't1', 't2', 't3', 't4', 't5'];
const languages = [
  { code: 'FR', name: 'Francais', nativeName: 'Francais' },
  { code: 'EN', name: 'Anglais', nativeName: 'English' },
  { code: 'TA', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'HI', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ML', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'TE', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'KN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'PA', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'GU', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'BN', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'MR', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'UR', name: 'Urdu', nativeName: 'اردو' },
  { code: 'OR', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
];

const listings = [
  { id: '1', city: 'Paris 13e', department: '75', type: 'studio', rent: 820, surface: 22, broker: 'Maison Tamil France' },
  { id: '2', city: 'Courbevoie', department: '92', type: 't2', rent: 1180, surface: 42, broker: 'Bridge Immo' },
  { id: '3', city: 'Creteil', department: '94', type: 't3', rent: 690, surface: 68, broker: 'Sud Residence' },
];

const requests = [
  { id: 'anjali', name: 'Anjali', area: 'Paris, 92', budget: 900 },
  { id: 'kavin', name: 'Kavin', area: '94, 77', budget: 1200 },
];

const i18n = {
  FR: {
    subtitle: 'Logement, brokers et news pour la communaute indienne en France',
    tabs: { client: 'Client', housing: 'Logements', broker: 'Broker', news: 'News' },
    heroTitle: 'Trouver un logement en France, sans parcours complique.',
    heroText: 'Le client depose une demande claire. Les brokers abonnes recoivent les demandes qui correspondent a leurs criteres.',
    searchHousing: 'Chercher un logement',
    requestTitle: 'Deposer ma demande',
    cityPlaceholder: 'Ville ou departement souhaite',
    budgetPlaceholder: 'Budget maximum',
    datePlaceholder: "Date d'entree souhaitee",
    sendRequest: 'Envoyer ma demande',
    filtersTitle: 'Filtres rapides',
    typeLabel: 'Type',
    departmentLabel: 'Departement',
    maxRentLabel: 'Loyer maximum',
    all: 'Tous',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Espace broker',
    companyPlaceholder: 'Nom de societe',
    contactPlaceholder: 'Contact professionnel',
    propertiesPlaceholder: 'Biens proposes a la location',
    freeTitle: 'Gratuit',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/mois',
    freeText: 'Demandes visibles, 5 clics coordonnees par jour, contact limite.',
    proText: 'Contacts illimites, visibilite, notifications ciblees.',
    notifications: 'Notifications Pro',
    housingTypes: 'Types de logement',
    tenantMaxRent: 'Loyer maximum possible pour le locataire',
    viewContact: 'Voir les coordonnees',
    budgetLabel: 'budget',
    languageTitle: 'Langue',
    languageSubtitle: "Choisir la langue de l'application",
    newsTitle: 'News Inde, France et tech',
    newsCaption: 'Resume court, utile et traduit automatiquement selon la langue choisie.',
    listings: ['Studio meuble proche metro', 'T2 lumineux pour jeune actif', 'Colocation calme pres campus'],
    requestNeeds: { anjali: 'Studio ou T1', kavin: 'T2' },
    requestTimings: { anjali: 'Avant septembre', kavin: 'Sous 30 jours' },
    requestLine: (name, need) => `${name} cherche ${need}`,
    news: [
      'Inde-France : les points a verifier pour les nouveaux etudiants',
      'Tech : startups IA, fintech et mobilite en forte croissance',
      'Logement : dossier, garant, assurance et premier loyer',
    ],
  },
  EN: {
    subtitle: 'Housing, brokers and news for the Indian community in France',
    tabs: { client: 'Client', housing: 'Homes', broker: 'Broker', news: 'News' },
    heroTitle: 'Find housing in France without a complicated journey.',
    heroText: 'Clients submit a clear request. Subscribed brokers receive matching requests based on their criteria.',
    searchHousing: 'Search housing',
    requestTitle: 'Submit my request',
    cityPlaceholder: 'Preferred city or department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Preferred move-in date',
    sendRequest: 'Send my request',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'All',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Business contact',
    propertiesPlaceholder: 'Rental properties offered',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: 'EUR 0',
    proPrice: 'EUR 10/month',
    freeText: 'Visible requests, 5 contact-detail clicks per day, limited contact.',
    proText: 'Unlimited contacts, visibility and targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum possible rent',
    viewContact: 'View contact details',
    budgetLabel: 'budget',
    languageTitle: 'Language',
    languageSubtitle: 'Choose the app language',
    newsTitle: 'India, France and tech news',
    newsCaption: 'Short useful summary, translated automatically for the selected language.',
    listings: ['Furnished studio near metro', 'Bright T2 for a young professional', 'Quiet shared flat near campus'],
    requestNeeds: { anjali: 'Studio or T1', kavin: 'T2' },
    requestTimings: { anjali: 'Before September', kavin: 'Within 30 days' },
    requestLine: (name, need) => `${name} is looking for ${need}`,
    news: [
      'India-France: points to check for new students',
      'Tech: AI, fintech and mobility startups are growing fast',
      'Housing: file, guarantor, insurance and first rent',
    ],
  },
  TA: {
    subtitle: 'பிரான்சில் உள்ள இந்திய சமூகத்திற்கான வீடு, brokers மற்றும் செய்திகள்',
    tabs: { client: 'கிளையண்ட்', housing: 'வீடுகள்', broker: 'Broker', news: 'செய்திகள்' },
    heroTitle: 'சிக்கலின்றி பிரான்சில் வீடு கண்டுபிடிக்கவும்.',
    heroText: 'வாடிக்கையாளர் தெளிவான கோரிக்கையை இடுகிறார். பொருந்தும் கோரிக்கைகள் சந்தா brokers-க்கு அனுப்பப்படும்.',
    searchHousing: 'வீடு தேடவும்',
    requestTitle: 'என் கோரிக்கையை இடு',
    cityPlaceholder: 'விரும்பிய நகரம் அல்லது துறை',
    budgetPlaceholder: 'அதிகபட்ச பட்ஜெட்',
    datePlaceholder: 'குடியேறும் தேதி',
    sendRequest: 'கோரிக்கையை அனுப்பு',
    filtersTitle: 'விரைவு வடிகட்டிகள்',
    typeLabel: 'வகை',
    departmentLabel: 'துறை',
    maxRentLabel: 'அதிகபட்ச வாடகை',
    all: 'அனைத்தும்',
    types: { studio: 'ஸ்டூடியோ', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker பகுதி',
    companyPlaceholder: 'நிறுவன பெயர்',
    contactPlaceholder: 'தொழில் தொடர்பு',
    propertiesPlaceholder: 'வாடகைக்கு உள்ள சொத்துகள்',
    freeTitle: 'இலவசம்',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/மாதம்',
    freeText: 'கோரிக்கைகள் தெரியும், நாளுக்கு 5 தொடர்பு கிளிக்குகள், வரையறுக்கப்பட்ட தொடர்பு.',
    proText: 'வரம்பற்ற தொடர்புகள், காட்சி மற்றும் இலக்கு அறிவிப்புகள்.',
    notifications: 'Pro அறிவிப்புகள்',
    housingTypes: 'வீட்டு வகைகள்',
    tenantMaxRent: 'வாடகையாளரின் அதிகபட்ச வாடகை',
    viewContact: 'தொடர்பு விவரம் பார்க்க',
    budgetLabel: 'பட்ஜெட்',
    languageTitle: 'மொழி',
    languageSubtitle: 'ஆப் மொழியை தேர்வு செய்யவும்',
    newsTitle: 'இந்தியா, பிரான்ஸ் மற்றும் tech செய்திகள்',
    newsCaption: 'தேர்ந்த மொழிக்கு தானாக மொழிபெயர்க்கப்படும் சுருக்கம்.',
    listings: ['மெட்ரோ அருகில் பொருட்களுடன் ஸ்டூடியோ', 'இளம் தொழிலாளிக்கான வெளிச்சமான T2', 'கேம்பஸ் அருகில் அமைதியான பகிர்வு வீடு'],
    requestNeeds: { anjali: 'ஸ்டூடியோ அல்லது T1', kavin: 'T2' },
    requestTimings: { anjali: 'செப்டம்பருக்கு முன்', kavin: '30 நாட்களுக்குள்' },
    requestLine: (name, need) => `${name} ${need} தேடுகிறார்`,
    news: ['இந்தியா-பிரான்ஸ்: புதிய மாணவர்கள் பார்க்க வேண்டியவை', 'Tech: AI, fintech, mobility startups வேகமாக வளர்கின்றன', 'வீடு: dossier, guarantor, insurance மற்றும் முதல் வாடகை'],
  },
  HI: {
    subtitle: 'फ्रांस में भारतीय समुदाय के लिए आवास, broker और news',
    tabs: { client: 'क्लाइंट', housing: 'घर', broker: 'Broker', news: 'न्यूज़' },
    heroTitle: 'फ्रांस में घर ढूंढना अब आसान है.',
    heroText: 'क्लाइंट साफ request डालता है. subscribed brokers को matching requests मिलती हैं.',
    searchHousing: 'घर खोजें',
    requestTitle: 'मेरी request डालें',
    cityPlaceholder: 'पसंदीदा शहर या department',
    budgetPlaceholder: 'अधिकतम budget',
    datePlaceholder: 'move-in date',
    sendRequest: 'request भेजें',
    filtersTitle: 'तेज़ filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'अधिकतम rent',
    all: 'सभी',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'किराये के properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/माह',
    freeText: 'Requests दिखेंगी, रोज़ 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility और targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant का maximum rent',
    viewContact: 'Contact details देखें',
    budgetLabel: 'budget',
    languageTitle: 'भाषा',
    languageSubtitle: 'App की भाषा चुनें',
    newsTitle: 'India, France और tech news',
    newsCaption: 'चुनी हुई भाषा में automatic short summary.',
    listings: ['Metro के पास furnished studio', 'Young professional के लिए bright T2', 'Campus के पास शांत shared flat'],
    requestNeeds: { anjali: 'Studio या T1', kavin: 'T2' },
    requestTimings: { anjali: 'September से पहले', kavin: '30 दिनों में' },
    requestLine: (name, need) => `${name} ${need} ढूंढ रहे हैं`,
    news: ['India-France: नए students के लिए check points', 'Tech: AI, fintech और mobility startups तेज़ी से बढ़ रहे हैं', 'Housing: file, guarantor, insurance और पहला rent'],
  },
  ML: {
    subtitle: 'ഫ്രാൻസിലെ ഇന്ത്യൻ സമൂഹത്തിനുള്ള വീട്, brokers, news',
    tabs: { client: 'ക്ലയന്റ്', housing: 'വീടുകൾ', broker: 'Broker', news: 'ന്യൂസ്' },
    heroTitle: 'ഫ്രാൻസിൽ വീട് കണ്ടെത്തൽ ഇനി ലളിതം.',
    heroText: 'ക്ലയന്റ് വ്യക്തമായ request നൽകുന്നു. പൊരുത്തമുള്ള requests subscribed brokers-ന് ലഭിക്കും.',
    searchHousing: 'വീട് തിരയുക',
    requestTitle: 'എന്റെ request നൽകുക',
    cityPlaceholder: 'ആഗ്രഹിക്കുന്ന നഗരം അല്ലെങ്കിൽ department',
    budgetPlaceholder: 'പരമാവധി budget',
    datePlaceholder: 'കുടിയേറുന്ന തീയതി',
    sendRequest: 'request അയക്കുക',
    filtersTitle: 'വേഗത്തിലുള്ള filters',
    typeLabel: 'തരം',
    departmentLabel: 'Department',
    maxRentLabel: 'പരമാവധി rent',
    all: 'എല്ലാം',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'കമ്പനി പേര്',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'വാടകയ്ക്കുള്ള properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/മാസം',
    freeText: 'Requests കാണാം, ദിവസം 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'വീടിന്റെ തരം',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details കാണുക',
    budgetLabel: 'budget',
    languageTitle: 'ഭാഷ',
    languageSubtitle: 'App language തിരഞ്ഞെടുക്കുക',
    newsTitle: 'India, France, tech news',
    newsCaption: 'തിരഞ്ഞെടുത്ത ഭാഷയിൽ automatic summary.',
    listings: ['Metro അടുത്തുള്ള furnished studio', 'Young professional നുള്ള bright T2', 'Campus അടുത്തുള്ള ശാന്തമായ shared flat'],
    requestNeeds: { anjali: 'Studio അല്ലെങ്കിൽ T1', kavin: 'T2' },
    requestTimings: { anjali: 'September മുമ്പ്', kavin: '30 ദിവസത്തിനകം' },
    requestLine: (name, need) => `${name} ${need} അന്വേഷിക്കുന്നു`,
    news: ['India-France: പുതിയ students ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ', 'Tech: AI, fintech, mobility startups വേഗത്തിൽ വളരുന്നു', 'Housing: file, guarantor, insurance, first rent'],
  },
  TE: {
    subtitle: 'ఫ్రాన్స్‌లోని భారతీయ సమాజానికి housing, brokers మరియు news',
    tabs: { client: 'క్లయింట్', housing: 'ఇళ్లు', broker: 'Broker', news: 'News' },
    heroTitle: 'ఫ్రాన్స్‌లో ఇల్లు కనుగొనడం సులభం.',
    heroText: 'క్లయింట్ స్పష్టమైన request ఇస్తాడు. సరిపోయే requests subscribed brokers‌కు వెళ్తాయి.',
    searchHousing: 'ఇల్లు వెతకండి',
    requestTitle: 'నా request ఇవ్వండి',
    cityPlaceholder: 'కావలసిన city లేదా department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request పంపండి',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'అన్నీ',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/నెల',
    freeText: 'Requests కనిపిస్తాయి, రోజుకు 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details చూడండి',
    budgetLabel: 'budget',
    languageTitle: 'భాష',
    languageSubtitle: 'App language ఎంచుకోండి',
    newsTitle: 'India, France and tech news',
    newsCaption: 'ఎంచుకున్న భాషలో automatic summary.',
    listings: ['Metro దగ్గర furnished studio', 'Young professional కోసం bright T2', 'Campus దగ్గర quiet shared flat'],
    requestNeeds: { anjali: 'Studio లేదా T1', kavin: 'T2' },
    requestTimings: { anjali: 'September ముందు', kavin: '30 రోజుల్లో' },
    requestLine: (name, need) => `${name} ${need} వెతుకుతున్నారు`,
    news: ['India-France: కొత్త students check చేయాల్సినవి', 'Tech: AI, fintech, mobility startups వేగంగా పెరుగుతున్నాయి', 'Housing: file, guarantor, insurance, first rent'],
  },
  KN: {
    subtitle: 'ಫ್ರಾನ್ಸ್‌ನ ಭಾರತೀಯ ಸಮುದಾಯಕ್ಕೆ housing, brokers ಮತ್ತು news',
    tabs: { client: 'Client', housing: 'ಮನೆಗಳು', broker: 'Broker', news: 'News' },
    heroTitle: 'ಫ್ರಾನ್ಸ್‌ನಲ್ಲಿ ಮನೆ ಹುಡುಕುವುದು ಸುಲಭ.',
    heroText: 'Client ಸ್ಪಷ್ಟ request ಹಾಕುತ್ತಾರೆ. matching requests subscribed brokers ಗೆ ಹೋಗುತ್ತವೆ.',
    searchHousing: 'ಮನೆ ಹುಡುಕಿ',
    requestTitle: 'ನನ್ನ request ಹಾಕಿ',
    cityPlaceholder: 'ಆಯ್ಕೆ city ಅಥವಾ department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request ಕಳುಹಿಸಿ',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'ಎಲ್ಲಾ',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/ತಿಂಗಳು',
    freeText: 'Requests visible, ದಿನಕ್ಕೆ 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details ನೋಡಿ',
    budgetLabel: 'budget',
    languageTitle: 'ಭಾಷೆ',
    languageSubtitle: 'App language ಆಯ್ಕೆಮಾಡಿ',
    newsTitle: 'India, France and tech news',
    newsCaption: 'ಆಯ್ಕೆ ಮಾಡಿದ ಭಾಷೆಯಲ್ಲಿ automatic summary.',
    listings: ['Metro ಹತ್ತಿರ furnished studio', 'Young professional ಗಾಗಿ bright T2', 'Campus ಹತ್ತಿರ quiet shared flat'],
    requestNeeds: { anjali: 'Studio ಅಥವಾ T1', kavin: 'T2' },
    requestTimings: { anjali: 'September ಮೊದಲು', kavin: '30 ದಿನಗಳಲ್ಲಿ' },
    requestLine: (name, need) => `${name} ${need} ಹುಡುಕುತ್ತಿದ್ದಾರೆ`,
    news: ['India-France: ಹೊಸ students ಗಮನಿಸಬೇಕಾದವು', 'Tech: AI, fintech, mobility startups ವೇಗವಾಗಿ ಬೆಳೆಯುತ್ತಿವೆ', 'Housing: file, guarantor, insurance, first rent'],
  },
  PA: {
    subtitle: 'ਫਰਾਂਸ ਵਿੱਚ ਭਾਰਤੀ ਕਮਿਊਨਿਟੀ ਲਈ housing, brokers ਅਤੇ news',
    tabs: { client: 'Client', housing: 'ਘਰ', broker: 'Broker', news: 'News' },
    heroTitle: 'ਫਰਾਂਸ ਵਿੱਚ ਘਰ ਲੱਭਣਾ ਆਸਾਨ.',
    heroText: 'Client clear request ਪਾਉਂਦਾ ਹੈ. matching requests subscribed brokers ਨੂੰ ਮਿਲਦੀਆਂ ਹਨ.',
    searchHousing: 'ਘਰ ਲੱਭੋ',
    requestTitle: 'ਮੇਰੀ request ਪਾਓ',
    cityPlaceholder: 'ਚਾਹੀਦਾ city ਜਾਂ department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request ਭੇਜੋ',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'ਸਾਰੇ',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/ਮਹੀਨਾ',
    freeText: 'Requests visible, ਰੋਜ਼ 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details ਵੇਖੋ',
    budgetLabel: 'budget',
    languageTitle: 'ਭਾਸ਼ਾ',
    languageSubtitle: 'App language ਚੁਣੋ',
    newsTitle: 'India, France and tech news',
    newsCaption: 'ਚੁਣੀ ਭਾਸ਼ਾ ਵਿੱਚ automatic summary.',
    listings: ['Metro ਨੇੜੇ furnished studio', 'Young professional ਲਈ bright T2', 'Campus ਨੇੜੇ quiet shared flat'],
    requestNeeds: { anjali: 'Studio ਜਾਂ T1', kavin: 'T2' },
    requestTimings: { anjali: 'September ਤੋਂ ਪਹਿਲਾਂ', kavin: '30 ਦਿਨਾਂ ਵਿੱਚ' },
    requestLine: (name, need) => `${name} ${need} ਲੱਭ ਰਹੇ ਹਨ`,
    news: ['India-France: ਨਵੇਂ students ਲਈ check points', 'Tech: AI, fintech, mobility startups ਤੇਜ਼ੀ ਨਾਲ ਵਧ ਰਹੇ ਹਨ', 'Housing: file, guarantor, insurance, first rent'],
  },
  GU: {
    subtitle: 'ફ્રાન્સની ભારતીય કોમ્યુનિટી માટે housing, brokers અને news',
    tabs: { client: 'Client', housing: 'ઘર', broker: 'Broker', news: 'News' },
    heroTitle: 'ફ્રાન્સમાં ઘર શોધવું હવે સરળ.',
    heroText: 'Client clear request મૂકે છે. matching requests subscribed brokers ને મળે છે.',
    searchHousing: 'ઘર શોધો',
    requestTitle: 'મારી request મૂકો',
    cityPlaceholder: 'પસંદ city અથવા department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request મોકલો',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'બધા',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/મહિનો',
    freeText: 'Requests visible, દરરોજ 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details જુઓ',
    budgetLabel: 'budget',
    languageTitle: 'ભાષા',
    languageSubtitle: 'App language પસંદ કરો',
    newsTitle: 'India, France and tech news',
    newsCaption: 'પસંદ ભાષામાં automatic summary.',
    listings: ['Metro પાસે furnished studio', 'Young professional માટે bright T2', 'Campus પાસે quiet shared flat'],
    requestNeeds: { anjali: 'Studio અથવા T1', kavin: 'T2' },
    requestTimings: { anjali: 'September પહેલાં', kavin: '30 દિવસમાં' },
    requestLine: (name, need) => `${name} ${need} શોધી રહ્યા છે`,
    news: ['India-France: નવા students માટે check points', 'Tech: AI, fintech, mobility startups ઝડપથી વધી રહ્યા છે', 'Housing: file, guarantor, insurance, first rent'],
  },
  BN: {
    subtitle: 'ফ্রান্সের ভারতীয় কমিউনিটির জন্য housing, brokers ও news',
    tabs: { client: 'Client', housing: 'বাড়ি', broker: 'Broker', news: 'News' },
    heroTitle: 'ফ্রান্সে বাড়ি খোঁজা এখন সহজ.',
    heroText: 'Client clear request দেয়. matching requests subscribed brokers পায়.',
    searchHousing: 'বাড়ি খুঁজুন',
    requestTitle: 'আমার request দিন',
    cityPlaceholder: 'পছন্দের city বা department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request পাঠান',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'সব',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/মাস',
    freeText: 'Requests visible, দিনে 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details দেখুন',
    budgetLabel: 'budget',
    languageTitle: 'ভাষা',
    languageSubtitle: 'App language বেছে নিন',
    newsTitle: 'India, France and tech news',
    newsCaption: 'নির্বাচিত ভাষায় automatic summary.',
    listings: ['Metro কাছাকাছি furnished studio', 'Young professional এর জন্য bright T2', 'Campus কাছাকাছি quiet shared flat'],
    requestNeeds: { anjali: 'Studio বা T1', kavin: 'T2' },
    requestTimings: { anjali: 'September এর আগে', kavin: '30 দিনের মধ্যে' },
    requestLine: (name, need) => `${name} ${need} খুঁজছেন`,
    news: ['India-France: নতুন students এর check points', 'Tech: AI, fintech, mobility startups দ্রুত বাড়ছে', 'Housing: file, guarantor, insurance, first rent'],
  },
  MR: {
    subtitle: 'फ्रान्समधील भारतीय समुदायासाठी housing, brokers आणि news',
    tabs: { client: 'Client', housing: 'घरे', broker: 'Broker', news: 'News' },
    heroTitle: 'फ्रान्समध्ये घर शोधणे सोपे.',
    heroText: 'Client clear request टाकतो. matching requests subscribed brokers ना मिळतात.',
    searchHousing: 'घर शोधा',
    requestTitle: 'माझी request टाका',
    cityPlaceholder: 'हवे असलेले city किंवा department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request पाठवा',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'सर्व',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/महिना',
    freeText: 'Requests visible, दररोज 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details पहा',
    budgetLabel: 'budget',
    languageTitle: 'भाषा',
    languageSubtitle: 'App language निवडा',
    newsTitle: 'India, France and tech news',
    newsCaption: 'निवडलेल्या भाषेत automatic summary.',
    listings: ['Metro जवळ furnished studio', 'Young professional साठी bright T2', 'Campus जवळ quiet shared flat'],
    requestNeeds: { anjali: 'Studio किंवा T1', kavin: 'T2' },
    requestTimings: { anjali: 'September आधी', kavin: '30 दिवसांत' },
    requestLine: (name, need) => `${name} ${need} शोधत आहेत`,
    news: ['India-France: नवीन students साठी check points', 'Tech: AI, fintech, mobility startups वेगाने वाढत आहेत', 'Housing: file, guarantor, insurance, first rent'],
  },
  UR: {
    subtitle: 'فرانس میں بھارتی کمیونٹی کے لیے housing، brokers اور news',
    tabs: { client: 'Client', housing: 'گھر', broker: 'Broker', news: 'News' },
    heroTitle: 'فرانس میں گھر تلاش کرنا آسان.',
    heroText: 'Client واضح request دیتا ہے. matching requests subscribed brokers کو ملتی ہیں.',
    searchHousing: 'گھر تلاش کریں',
    requestTitle: 'میری request بھیجیں',
    cityPlaceholder: 'پسندیدہ city یا department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request بھیجیں',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'سب',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/مہینہ',
    freeText: 'Requests visible، روزانہ 5 contact clicks، limited contact.',
    proText: 'Unlimited contacts، visibility، targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details دیکھیں',
    budgetLabel: 'budget',
    languageTitle: 'زبان',
    languageSubtitle: 'App language منتخب کریں',
    newsTitle: 'India, France and tech news',
    newsCaption: 'منتخب زبان میں automatic summary.',
    listings: ['Metro کے قریب furnished studio', 'Young professional کے لیے bright T2', 'Campus کے قریب quiet shared flat'],
    requestNeeds: { anjali: 'Studio یا T1', kavin: 'T2' },
    requestTimings: { anjali: 'September سے پہلے', kavin: '30 دن میں' },
    requestLine: (name, need) => `${name} ${need} تلاش کر رہے ہیں`,
    news: ['India-France: نئے students کے check points', 'Tech: AI, fintech, mobility startups تیزی سے بڑھ رہے ہیں', 'Housing: file, guarantor, insurance, first rent'],
  },
  OR: {
    subtitle: 'ଫ୍ରାନ୍ସରେ ଭାରତୀୟ ସମୁଦାୟ ପାଇଁ housing, brokers ଏବଂ news',
    tabs: { client: 'Client', housing: 'ଘର', broker: 'Broker', news: 'News' },
    heroTitle: 'ଫ୍ରାନ୍ସରେ ଘର ଖୋଜିବା ସହଜ.',
    heroText: 'Client ସ୍ପଷ୍ଟ request ଦେଇଥାନ୍ତି. matching requests subscribed brokers କୁ ମିଳେ.',
    searchHousing: 'ଘର ଖୋଜନ୍ତୁ',
    requestTitle: 'ମୋ request ଦିଅନ୍ତୁ',
    cityPlaceholder: 'ପସନ୍ଦର city କିମ୍ବା department',
    budgetPlaceholder: 'Maximum budget',
    datePlaceholder: 'Move-in date',
    sendRequest: 'request ପଠାନ୍ତୁ',
    filtersTitle: 'Quick filters',
    typeLabel: 'Type',
    departmentLabel: 'Department',
    maxRentLabel: 'Maximum rent',
    all: 'ସବୁ',
    types: { studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4', t5: 'T5+' },
    brokerLabel: 'Broker',
    brokerSpace: 'Broker space',
    companyPlaceholder: 'Company name',
    contactPlaceholder: 'Professional contact',
    propertiesPlaceholder: 'Rental properties',
    freeTitle: 'Free',
    proTitle: 'Pro',
    freePrice: '0 EUR',
    proPrice: '10 EUR/ମାସ',
    freeText: 'Requests visible, ଦିନକୁ 5 contact clicks, limited contact.',
    proText: 'Unlimited contacts, visibility, targeted notifications.',
    notifications: 'Pro notifications',
    housingTypes: 'Housing types',
    tenantMaxRent: 'Tenant maximum rent',
    viewContact: 'Contact details ଦେଖନ୍ତୁ',
    budgetLabel: 'budget',
    languageTitle: 'ଭାଷା',
    languageSubtitle: 'App language ବାଛନ୍ତୁ',
    newsTitle: 'India, France and tech news',
    newsCaption: 'ଚୟନିତ ଭାଷାରେ automatic summary.',
    listings: ['Metro ପାଖରେ furnished studio', 'Young professional ପାଇଁ bright T2', 'Campus ପାଖରେ quiet shared flat'],
    requestNeeds: { anjali: 'Studio କିମ୍ବା T1', kavin: 'T2' },
    requestTimings: { anjali: 'September ପୂର୍ବରୁ', kavin: '30 ଦିନ ମଧ୍ୟରେ' },
    requestLine: (name, need) => `${name} ${need} ଖୋଜୁଛନ୍ତି`,
    news: ['India-France: ନୂଆ students ପାଇଁ check points', 'Tech: AI, fintech, mobility startups ଶୀଘ୍ର ବଢୁଛି', 'Housing: file, guarantor, insurance, first rent'],
  },
};

const currencyLabel = 'EUR';

const brokerI18n = {
  FR: {
    accessText: 'Connectez-vous ou creez votre compte broker pour gerer vos biens et vos demandes.',
    login: 'Connexion',
    signup: 'Inscription',
    loginTitle: 'Connexion broker',
    signupTitle: 'Inscription broker',
    companySignupPlaceholder: 'Nom',
    emailPlaceholder: 'Email professionnel',
    phonePlaceholder: 'Telephone professionnel',
    passwordPlaceholder: 'Mot de passe',
    loginSubmit: 'Me connecter',
    signupSubmit: 'Creer mon compte',
    switchToSignup: 'Creer un compte broker',
    switchToLogin: 'J ai deja un compte',
    connectedTitle: 'Compte broker connecte',
    connectedText: 'Vous pouvez maintenant gerer vos biens, vos notifications et les demandes clients.',
    logout: 'Se deconnecter',
    comparisonTitle: 'Comparatif des offres',
    criteria: 'Criteres',
    companyInfo: 'Informations societe',
    features: {
      contactDetails: 'Voir les coordonnées de clients',
      housingRequestSectorAlert: "Notifications lorsqu'un client formule une demande de logement dans votre secteur",
      ownerListingSectorAlert: "Notification lorsqu'un propriétaire propose son bien à la location dans votre secteur",
      publishAvailableListings: 'Publiez vos biens disponibles',
      messaging: 'Messagerie',
    },
    featureValues: {
      fivePerDay: '5 coordonnées/jour',
      unlimited: 'illimité',
    },
  },
  EN: {
    accessText: 'Log in or create your broker account to manage listings and client requests.',
    login: 'Log in',
    signup: 'Sign up',
    loginTitle: 'Broker login',
    signupTitle: 'Broker sign up',
    companySignupPlaceholder: 'Name',
    emailPlaceholder: 'Business email',
    phonePlaceholder: 'Business phone',
    passwordPlaceholder: 'Password',
    loginSubmit: 'Log in',
    signupSubmit: 'Create my account',
    switchToSignup: 'Create a broker account',
    switchToLogin: 'I already have an account',
    connectedTitle: 'Broker account connected',
    connectedText: 'You can now manage listings, notifications and client requests.',
    logout: 'Log out',
    comparisonTitle: 'Plan comparison',
    criteria: 'Criteria',
    companyInfo: 'Company information',
    features: {
      contactDetails: 'View client contact details',
      housingRequestSectorAlert: 'Notifications when a client submits a housing request in your area',
      ownerListingSectorAlert: 'Notifications when an owner offers a rental property in your area',
      publishAvailableListings: 'Publish your available properties',
      messaging: 'Messaging',
    },
    featureValues: {
      fivePerDay: '5 contact details/day',
      unlimited: 'unlimited',
    },
  },
  TA: {
    accessText: 'உங்கள் broker account-ல் login செய்யவும் அல்லது புதிய account உருவாக்கவும்.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests பார்க்க',
      fiveContacts: 'ஒரு நாளுக்கு 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients-ஐ contact செய்ய',
      beContacted: 'Clients contact செய்யலாம்',
      alerts: 'Targeted notifications',
      listings: 'Listings publish செய்ய',
    },
  },
  HI: {
    accessText: 'अपना broker account login करें या नया account बनाएं.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests देखें',
      fiveContacts: 'हर दिन 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients को contact करें',
      beContacted: 'Clients आपसे contact करें',
      alerts: 'Targeted notifications',
      listings: 'Listings publish करें',
    },
  },
  ML: {
    accessText: 'Broker account login ചെയ്യുക അല്ലെങ്കില്‍ പുതിയ account സൃഷ്ടിക്കുക.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests കാണുക',
      fiveContacts: 'ദിവസം 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients-നെ contact ചെയ്യുക',
      beContacted: 'Clients contact ചെയ്യാം',
      alerts: 'Targeted notifications',
      listings: 'Listings publish ചെയ്യുക',
    },
  },
  TE: {
    accessText: 'Broker account login చేయండి లేదా కొత్త account సృష్టించండి.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests చూడండి',
      fiveContacts: 'రోజుకు 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact చేయండి',
      beContacted: 'Clients contact చేయగలరు',
      alerts: 'Targeted notifications',
      listings: 'Listings publish చేయండి',
    },
  },
  KN: {
    accessText: 'Broker account login ಮಾಡಿ ಅಥವಾ ಹೊಸ account ರಚಿಸಿ.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests ನೋಡಿ',
      fiveContacts: 'ದಿನಕ್ಕೆ 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact ಮಾಡಿ',
      beContacted: 'Clients contact ಮಾಡಬಹುದು',
      alerts: 'Targeted notifications',
      listings: 'Listings publish ಮಾಡಿ',
    },
  },
  PA: {
    accessText: 'Broker account login ਕਰੋ ਜਾਂ ਨਵਾਂ account ਬਣਾਓ.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests ਵੇਖੋ',
      fiveContacts: 'ਰੋਜ਼ 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact ਕਰੋ',
      beContacted: 'Clients contact ਕਰ ਸਕਦੇ ਹਨ',
      alerts: 'Targeted notifications',
      listings: 'Listings publish ਕਰੋ',
    },
  },
  GU: {
    accessText: 'Broker account login કરો અથવા નવું account બનાવો.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests જુઓ',
      fiveContacts: 'દરરોજ 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact કરો',
      beContacted: 'Clients contact કરી શકે',
      alerts: 'Targeted notifications',
      listings: 'Listings publish કરો',
    },
  },
  BN: {
    accessText: 'Broker account login করুন অথবা নতুন account তৈরি করুন.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests দেখুন',
      fiveContacts: 'প্রতিদিন 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact করুন',
      beContacted: 'Clients contact করতে পারে',
      alerts: 'Targeted notifications',
      listings: 'Listings publish করুন',
    },
  },
  MR: {
    accessText: 'Broker account login करा किंवा नवीन account तयार करा.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests पहा',
      fiveContacts: 'दररोज 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact करा',
      beContacted: 'Clients contact करू शकतात',
      alerts: 'Targeted notifications',
      listings: 'Listings publish करा',
    },
  },
  UR: {
    accessText: 'Broker account login کریں یا نیا account بنائیں.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests دیکھیں',
      fiveContacts: 'روزانہ 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact کریں',
      beContacted: 'Clients contact کر سکتے ہیں',
      alerts: 'Targeted notifications',
      listings: 'Listings publish کریں',
    },
  },
  OR: {
    accessText: 'Broker account login କରନ୍ତୁ କିମ୍ବା ନୂଆ account ତିଆରି କରନ୍ତୁ.',
    login: 'Login',
    signup: 'Sign up',
    comparisonTitle: 'Offer comparison',
    criteria: 'Criteria',
    companyInfo: 'Company info',
    features: {
      requests: 'Client requests ଦେଖନ୍ତୁ',
      fiveContacts: 'ଦିନକୁ 5 contacts',
      unlimitedContacts: 'Unlimited contacts',
      contactClients: 'Clients contact କରନ୍ତୁ',
      beContacted: 'Clients contact କରିପାରିବେ',
      alerts: 'Targeted notifications',
      listings: 'Listings publish କରନ୍ତୁ',
    },
  },
};

const brokerFeatureRows = [
  { key: 'contactDetails', freeValueKey: 'fivePerDay', proValueKey: 'unlimited' },
  { key: 'housingRequestSectorAlert', free: false, pro: true },
  { key: 'ownerListingSectorAlert', free: false, pro: true },
  { key: 'publishAvailableListings', free: false, pro: true },
  { key: 'messaging', free: false, pro: true },
];

function getBrokerText(code) {
  const text = brokerI18n[code] || brokerI18n.FR;
  return {
    ...brokerI18n.FR,
    ...text,
    features: { ...brokerI18n.FR.features, ...(text.features || {}) },
    featureValues: { ...brokerI18n.FR.featureValues, ...(text.featureValues || {}) },
  };
}

export default function App() {
  const [tab, setTab] = useState('client');
  const [language, setLanguage] = useState(languages[0]);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [brokerAuthMode, setBrokerAuthMode] = useState(null);
  const [brokerAccount, setBrokerAccount] = useState(null);
  const [type, setType] = useState('all');
  const [department, setDepartment] = useState('all');
  const [maxRent, setMaxRent] = useState('1200');

  const t = i18n[language.code] || i18n.FR;
  const brokerText = getBrokerText(language.code);

  const filteredListings = useMemo(() => {
    const rent = Number(maxRent) || 99999;
    return listings.filter((item) => {
      return (type === 'all' || item.type === type)
        && (department === 'all' || item.department === department)
        && item.rent <= rent;
    });
  }, [department, maxRent, type]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.logo}>Nanba</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
        </View>
        <Pressable style={styles.languageBadge} onPress={() => setLanguageModalVisible(true)}>
          <Text style={styles.languageBadgeText}>{language.code}</Text>
        </Pressable>
      </View>

      <LanguagePicker
        currentLanguage={language}
        onClose={() => setLanguageModalVisible(false)}
        onSelect={(item) => {
          setLanguage(item);
          setLanguageModalVisible(false);
        }}
        t={t}
        visible={languageModalVisible}
      />

      <BrokerAuthModal
        brokerText={brokerText}
        mode={brokerAuthMode}
        onClose={() => setBrokerAuthMode(null)}
        onSubmit={(account) => {
          setBrokerAccount(account);
          setBrokerAuthMode(null);
        }}
        onSwitch={(mode) => setBrokerAuthMode(mode)}
        visible={brokerAuthMode !== null}
      />

      <View style={styles.tabs}>
        {[
          ['client', t.tabs.client],
          ['housing', t.tabs.housing],
          ['broker', t.tabs.broker],
          ['news', t.tabs.news],
        ].map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'client' && (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>{t.heroTitle}</Text>
              <Text style={styles.heroText}>{t.heroText}</Text>
              <Pressable style={styles.primaryButton} onPress={() => setTab('housing')}>
                <Text style={styles.primaryButtonText}>{t.searchHousing}</Text>
              </Pressable>
            </View>
            <RequestForm t={t} />
          </>
        )}

        {tab === 'housing' && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t.filtersTitle}</Text>
              <Text style={styles.label}>{t.typeLabel}</Text>
              <View style={styles.wrap}>
                <Chip label={t.all} active={type === 'all'} onPress={() => setType('all')} />
                {typeOptions.map((item) => (
                  <Chip key={item} label={t.types[item]} active={type === item} onPress={() => setType(item)} />
                ))}
              </View>
              <Text style={styles.label}>{t.departmentLabel}</Text>
              <View style={styles.wrap}>
                <Chip label={t.all} active={department === 'all'} onPress={() => setDepartment('all')} />
                {departments.map((item) => (
                  <Chip key={item} label={item} active={department === item} onPress={() => setDepartment(item)} />
                ))}
              </View>
              <Text style={styles.label}>{t.maxRentLabel}</Text>
              <TextInput value={maxRent} onChangeText={setMaxRent} keyboardType="number-pad" style={styles.input} />
            </View>
            {filteredListings.map((item, index) => <Listing key={item.id} index={index} item={item} t={t} />)}
          </>
        )}

        {tab === 'broker' && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{t.brokerSpace}</Text>
              {brokerAccount ? (
                <View style={styles.brokerAccountBox}>
                  <View style={styles.brokerAccountHeader}>
                    <View>
                      <Text style={styles.brokerAccountTitle}>{brokerText.connectedTitle}</Text>
                      <Text style={styles.brokerAccountName}>{brokerAccount.company}</Text>
                    </View>
                    <Text style={styles.brokerAccountBadge}>Pro</Text>
                  </View>
                  <Text style={styles.panelText}>{brokerText.connectedText}</Text>
                  <Pressable style={[styles.authButton, styles.authButtonSecondary]} onPress={() => setBrokerAccount(null)}>
                    <Text style={styles.authButtonSecondaryText}>{brokerText.logout}</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.panelText}>{brokerText.accessText}</Text>
                  <View style={styles.authRow}>
                    <Pressable style={[styles.authButton, styles.authButtonSecondary]} onPress={() => setBrokerAuthMode('login')}>
                      <Text style={styles.authButtonSecondaryText}>{brokerText.login}</Text>
                    </Pressable>
                    <Pressable style={[styles.authButton, styles.authButtonPrimary]} onPress={() => setBrokerAuthMode('signup')}>
                      <Text style={styles.authButtonPrimaryText}>{brokerText.signup}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
            <BrokerComparison brokerText={brokerText} t={t} />
            {brokerAccount && (
              <>
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>{brokerText.companyInfo}</Text>
                  <TextInput style={styles.input} placeholder={t.companyPlaceholder} placeholderTextColor="#8d8275" />
                  <TextInput style={styles.input} placeholder={t.contactPlaceholder} placeholderTextColor="#8d8275" />
                  <TextInput style={styles.input} placeholder={t.propertiesPlaceholder} placeholderTextColor="#8d8275" />
                </View>
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>{t.notifications}</Text>
                  <Text style={styles.label}>{t.departmentLabel}</Text>
                  <View style={styles.wrap}>{departments.map((item) => <Text key={item} style={styles.tag}>{item}</Text>)}</View>
                  <Text style={styles.label}>{t.housingTypes}</Text>
                  <View style={styles.wrap}>{typeOptions.map((item) => <Text key={item} style={styles.tag}>{t.types[item]}</Text>)}</View>
                  <Text style={styles.label}>{t.tenantMaxRent}</Text>
                  <TextInput style={styles.input} value={`1200 ${currencyLabel}`} editable={false} />
                </View>
                {requests.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{t.requestLine(item.name, t.requestNeeds[item.id])}</Text>
                    <Text style={styles.cardMeta}>{item.area} · {t.budgetLabel} {item.budget} {currencyLabel} · {t.requestTimings[item.id]}</Text>
                    <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.viewContact}</Text></Pressable>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'news' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t.newsTitle}</Text>
            {t.news.map((item) => (
              <View key={item} style={styles.newsItem}>
                <Text style={styles.newsTitle}>{item}</Text>
                <Text style={styles.cardMeta}>{t.newsCaption}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LanguagePicker({ currentLanguage, onClose, onSelect, t, visible }) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.languageSheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{t.languageTitle}</Text>
              <Text style={styles.sheetSubtitle}>{t.languageSubtitle}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>X</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {languages.map((item) => {
              const active = currentLanguage.code === item.code;
              return (
                <Pressable
                  key={item.code}
                  onPress={() => onSelect(item)}
                  style={[styles.languageOption, active && styles.languageOptionActive]}
                >
                  <View style={styles.languageOptionTextBlock}>
                    <Text style={[styles.languageOptionName, active && styles.languageOptionNameActive]}>{item.name}</Text>
                    <Text style={[styles.languageOptionNative, active && styles.languageOptionNativeActive]}>{item.nativeName}</Text>
                  </View>
                  <Text style={[styles.languageOptionCode, active && styles.languageOptionCodeActive]}>{item.code}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BrokerAuthModal({ brokerText, mode, onClose, onSubmit, onSwitch, visible }) {
  const isSignup = mode === 'signup';
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    onSubmit({
      company: company.trim() || 'Nanba Broker',
      email: email.trim() || 'broker@nanba.app',
      phone: phone.trim(),
    });
    setPassword('');
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.authSheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{isSignup ? brokerText.signupTitle : brokerText.loginTitle}</Text>
              <Text style={styles.sheetSubtitle}>{brokerText.accessText}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>X</Text>
            </Pressable>
          </View>

          {isSignup && (
            <TextInput
              style={styles.input}
              value={company}
              onChangeText={setCompany}
              placeholder={brokerText.companySignupPlaceholder}
              placeholderTextColor="#8d8275"
            />
          )}
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={brokerText.emailPlaceholder}
            placeholderTextColor="#8d8275"
          />
          {isSignup && (
            <TextInput
              keyboardType="phone-pad"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={brokerText.phonePlaceholder}
              placeholderTextColor="#8d8275"
            />
          )}
          <TextInput
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={brokerText.passwordPlaceholder}
            placeholderTextColor="#8d8275"
          />

          <Pressable style={styles.secondaryButton} onPress={submit}>
            <Text style={styles.secondaryButtonText}>{isSignup ? brokerText.signupSubmit : brokerText.loginSubmit}</Text>
          </Pressable>
          <Pressable style={styles.authSwitchButton} onPress={() => onSwitch(isSignup ? 'login' : 'signup')}>
            <Text style={styles.authSwitchText}>{isSignup ? brokerText.switchToLogin : brokerText.switchToSignup}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RequestForm({ t }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{t.requestTitle}</Text>
      <TextInput style={styles.input} placeholder={t.cityPlaceholder} placeholderTextColor="#8d8275" />
      <TextInput style={styles.input} placeholder={t.budgetPlaceholder} placeholderTextColor="#8d8275" keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder={t.datePlaceholder} placeholderTextColor="#8d8275" />
      <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t.sendRequest}</Text></Pressable>
    </View>
  );
}

function Chip({ active, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Listing({ index, item, t }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t.listings[index]}</Text>
        <Text style={styles.price}>{item.rent} {currencyLabel}</Text>
      </View>
      <Text style={styles.cardMeta}>{item.city} · {t.types[item.type]} · {item.surface} m2</Text>
      <Text style={styles.cardMeta}>{t.brokerLabel} : {item.broker}</Text>
    </View>
  );
}

function BrokerComparison({ brokerText, t }) {
  return (
    <View style={styles.comparisonPanel}>
      <Text style={styles.panelTitle}>{brokerText.comparisonTitle}</Text>
      <View style={styles.comparisonHeader}>
        <Text style={[styles.comparisonHeaderText, styles.comparisonCriteria]}>{brokerText.criteria}</Text>
        <View style={styles.comparisonPlanHeader}>
          <Text style={styles.comparisonPlanTitle}>{t.freeTitle}</Text>
          <Text style={styles.comparisonPlanPrice}>{t.freePrice}</Text>
        </View>
        <View style={[styles.comparisonPlanHeader, styles.comparisonPlanHeaderPro]}>
          <Text style={[styles.comparisonPlanTitle, styles.comparisonPlanTitlePro]}>{t.proTitle}</Text>
          <Text style={[styles.comparisonPlanPrice, styles.comparisonPlanPricePro]}>{t.proPrice}</Text>
        </View>
      </View>
      {brokerFeatureRows.map((row) => (
        <View key={row.key} style={styles.comparisonRow}>
          <Text style={styles.comparisonFeature}>{brokerText.features[row.key]}</Text>
          <FeatureMark value={row.freeValueKey ? brokerText.featureValues[row.freeValueKey] : row.free} />
          <FeatureMark value={row.proValueKey ? brokerText.featureValues[row.proValueKey] : row.pro} />
        </View>
      ))}
    </View>
  );
}

function FeatureMark({ value }) {
  if (typeof value === 'string') {
    return (
      <View style={styles.featureMarkCell}>
        <Text style={styles.featureValue}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={styles.featureMarkCell}>
      <Text style={[styles.featureMark, value ? styles.featureMarkYes : styles.featureMarkNo]}>
        {value ? '✓' : '×'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff8f0' },
  topBar: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 30, fontWeight: '900', color: '#16201b' },
  subtitle: { width: 260, marginTop: 2, color: '#6d6257', fontSize: 12, lineHeight: 16 },
  languageBadge: { minWidth: 58, minHeight: 58, backgroundColor: '#16201b', borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  languageBadgeText: { color: '#ffffff', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(22, 32, 27, 0.38)', justifyContent: 'flex-end' },
  languageSheet: { maxHeight: '78%', backgroundColor: '#fff8f0', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, gap: 14 },
  authSheet: { backgroundColor: '#fff8f0', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, gap: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  sheetTitle: { color: '#16201b', fontSize: 24, fontWeight: '900' },
  sheetSubtitle: { color: '#6d6257', marginTop: 2, fontWeight: '700' },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#16201b', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  languageOption: { minHeight: 64, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#eadfd2', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  languageOptionActive: { backgroundColor: '#16201b', borderColor: '#16201b' },
  languageOptionTextBlock: { flex: 1 },
  languageOptionName: { color: '#16201b', fontSize: 16, fontWeight: '900' },
  languageOptionNameActive: { color: '#ffffff' },
  languageOptionNative: { marginTop: 3, color: '#6d6257', fontSize: 18, fontWeight: '800' },
  languageOptionNativeActive: { color: '#c9d8cd' },
  languageOptionCode: { color: '#e84d35', fontWeight: '900' },
  languageOptionCodeActive: { color: '#f7c84b' },
  tabs: { marginHorizontal: 18, padding: 4, borderRadius: 20, backgroundColor: '#f0e4d6', flexDirection: 'row', gap: 4 },
  tab: { flex: 1, minHeight: 52, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: '#ffffff' },
  tabText: { color: '#6d6257', fontWeight: '800', fontSize: 11, textAlign: 'center' },
  tabTextActive: { color: '#16201b' },
  content: { padding: 18, paddingBottom: 34, gap: 14 },
  hero: { backgroundColor: '#16201b', borderRadius: 26, padding: 22, minHeight: 230, justifyContent: 'space-between' },
  heroTitle: { color: '#ffffff', fontSize: 27, lineHeight: 33, fontWeight: '900' },
  heroText: { color: '#c9d8cd', lineHeight: 21, marginTop: 12 },
  primaryButton: { marginTop: 22, backgroundColor: '#f7c84b', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  primaryButtonText: { color: '#16201b', fontWeight: '900', textAlign: 'center' },
  panel: { backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#eadfd2', gap: 10 },
  panelTitle: { fontSize: 20, fontWeight: '900', color: '#16201b' },
  panelText: { color: '#6d6257', lineHeight: 20, fontWeight: '700' },
  authRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  authButton: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  authButtonSecondary: { backgroundColor: '#fff8f0', borderWidth: 1, borderColor: '#eadfd2' },
  authButtonPrimary: { backgroundColor: '#16201b' },
  authButtonSecondaryText: { color: '#16201b', fontWeight: '900', textAlign: 'center' },
  authButtonPrimaryText: { color: '#ffffff', fontWeight: '900', textAlign: 'center' },
  authSwitchButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  authSwitchText: { color: '#e84d35', fontWeight: '900', textAlign: 'center' },
  brokerAccountBox: { gap: 10 },
  brokerAccountHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brokerAccountTitle: { color: '#137a4d', fontSize: 13, fontWeight: '900' },
  brokerAccountName: { color: '#16201b', fontSize: 18, fontWeight: '900', marginTop: 2 },
  brokerAccountBadge: { backgroundColor: '#16201b', color: '#f7c84b', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, overflow: 'hidden', fontWeight: '900' },
  input: { backgroundColor: '#fff8f0', borderWidth: 1, borderColor: '#eadfd2', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: '#16201b' },
  secondaryButton: { marginTop: 4, backgroundColor: '#e84d35', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#ffffff', fontWeight: '900', textAlign: 'center' },
  label: { marginTop: 8, color: '#6d6257', fontWeight: '900' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#fff8f0', borderWidth: 1, borderColor: '#eadfd2' },
  chipActive: { backgroundColor: '#16201b', borderColor: '#16201b' },
  chipText: { color: '#4e443b', fontWeight: '800' },
  chipTextActive: { color: '#ffffff' },
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#eadfd2', gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardTitle: { flex: 1, fontSize: 18, lineHeight: 23, color: '#16201b', fontWeight: '900' },
  price: { color: '#e84d35', fontSize: 18, fontWeight: '900' },
  cardMeta: { color: '#6d6257', lineHeight: 20 },
  tag: { backgroundColor: '#eef4ef', color: '#315342', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, overflow: 'hidden', fontWeight: '800' },
  comparisonPanel: { backgroundColor: '#ffffff', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: '#eadfd2', gap: 8 },
  comparisonHeader: { minHeight: 70, flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  comparisonHeaderText: { color: '#6d6257', fontSize: 12, fontWeight: '900' },
  comparisonCriteria: { flex: 1.7, alignSelf: 'center' },
  comparisonPlanHeader: { flex: 1, borderRadius: 16, backgroundColor: '#fff8f0', borderWidth: 1, borderColor: '#eadfd2', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  comparisonPlanHeaderPro: { backgroundColor: '#16201b', borderColor: '#16201b' },
  comparisonPlanTitle: { color: '#16201b', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  comparisonPlanTitlePro: { color: '#ffffff' },
  comparisonPlanPrice: { marginTop: 2, color: '#e84d35', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  comparisonPlanPricePro: { color: '#f7c84b' },
  comparisonRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: '#f0e4d6', paddingTop: 8 },
  comparisonFeature: { flex: 1.7, color: '#16201b', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  featureMarkCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  featureMark: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', textAlign: 'center', lineHeight: 30, fontSize: 19, fontWeight: '900' },
  featureMarkYes: { color: '#137a4d', backgroundColor: '#e7f5ed' },
  featureMarkNo: { color: '#c7352a', backgroundColor: '#fde8e4' },
  featureValue: { minHeight: 34, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e7f5ed', color: '#137a4d', paddingHorizontal: 6, paddingVertical: 5, textAlign: 'center', fontSize: 10, lineHeight: 12, fontWeight: '900' },
  newsItem: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eadfd2', gap: 6 },
  newsTitle: { color: '#16201b', fontWeight: '900', fontSize: 16, lineHeight: 21 },
});
