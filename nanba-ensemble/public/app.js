const $ = (s) => document.querySelector(s);
const state = {
  me: null,
  group: localStorage.getItem("nanba-group") || "",
  language: localStorage.getItem("nanba-language") || "fr",
  config: {},
  record: null,
  items: [],
  route: "home",
  csrf: "",
  request: 0,
};
const copy = {
  status: ["État", "Status"],
  culture: ["Culture", "Culture"],
  events: ["Événements", "Events"],
  administrative: ["Démarches", "Administration"],
  home: ["Vue d’ensemble", "Overview"],
  request: ["On le fait ensemble", "Let’s do it together"],
  meetup: ["Petites rencontres", "Small gatherings"],
  housing: ["Mon logement", "Housing"],
  help: ["20 minutes d’entraide", "20 minutes of help"],
  radar: ["Radar terrain", "Community radar"],
  cohort: ["Nouveaux arrivants", "New arrivals"],
  challenge: ["Défis entre villes", "City challenges"],
  story: ["Histoires de famille", "Family stories"],
  mine: ["Mon espace", "My space"],
  admin: ["Administration", "Administration"],
  whatsapp: ["Connexion WhatsApp", "WhatsApp connection"],
  assistant: ["L’assistant Nanba", "Nanba assistant"],
  pro: ["Espace professionnel", "Partner workspace"],
  source: ["Sources & connaissances", "Sources & knowledge"],
  digest: ["Publications", "Publications"],
  volunteer: ["Volontaires", "Volunteers"],
  document: ["Connaissances", "Knowledge"],
  offer: ["Offres", "Offers"],
  housing_offer: ["Propositions de logement", "Housing proposals"],
  community: ["LA COMMUNAUTÉ", "COMMUNITY"],
  account: ["VOTRE ESPACE", "YOUR SPACE"],
  hello: ["Bonjour", "Hello"],
  homeSub: [
    "Des idées partagées aux petits moments qui nous rapprochent.",
    "Shared ideas. Small moments. A community that brings us together.",
  ],
  heroTitle: [
    "Propose une idée.<br>Trouve les personnes.<br>Faisons-la.",
    "Share an idea.<br>Find your people.<br>Make it happen.",
  ],
  heroSub: [
    "Un atelier, une sortie, un coup de main… les belles choses commencent souvent à quelques-uns.",
    "A workshop, a day out, a helping hand… good things often begin with a few people.",
  ],
  propose: ["Proposer une idée", "Share an idea"],
  discover: ["À faire ensemble", "Make it happen"],
  all: ["Tout voir", "View all"],
  next: ["La prochaine rencontre", "The next gathering"],
  latest: ["Repéré près de vous", "Spotted nearby"],
  promise: [
    "Un peu plus proches, même loin de chez nous.",
    "A little closer, even far from home.",
  ],
  welcome: ["Bienvenue dans votre communauté.", "Welcome to your community."],
  simulation: [
    "Simulation · aucun message réel",
    "Simulation · no real messages",
  ],
  demoNote: [
    "Espace de développement · données fictives. Les inscriptions sont locales, sans réservation externe ni paiement.",
    "Development workspace · synthetic data. Registrations are local; no external booking or payment.",
  ],
  create: ["Créer", "Create"],
  new: ["Nouvelle proposition", "New proposal"],
  details: ["Voir le détail", "View details"],
  view: ["Consulter", "View"],
  cancel: ["Annuler", "Cancel"],
  save: ["Enregistrer", "Save"],
  close: ["Fermer", "Close"],
  send: ["Envoyer", "Send"],
  publish: ["Valider la publication", "Approve publication"],
  interest: ["Ça m’intéresse", "I’m interested"],
  withdrawInterest: ["Retirer mon intérêt", "Withdraw interest"],
  voteNote: [
    "Un intérêt n’est ni une réservation, ni un paiement.",
    "Interest is neither a booking nor a payment.",
  ],
  threshold: ["personnes souhaitées", "people needed"],
  verified: ["comptes vérifiés", "verified accounts"],
  provisional: [
    "intérêts WhatsApp provisoires",
    "provisional WhatsApp interests",
  ],
  pending: ["En attente", "Pending"],
  proposed: ["Proposé", "Proposed"],
  open: ["Ouvert", "Open"],
  confirmed: ["Confirmé", "Confirmed"],
  draft: ["Brouillon", "Draft"],
  simulated: ["Simulé", "Simulated"],
  published: ["Publié", "Published"],
  approved: ["Validé par l’auteur", "Author approved"],
  active: ["Actif", "Active"],
  paused: ["En pause", "Paused"],
  suspended: ["Suspendu", "Suspended"],
  satisfied: ["Satisfait", "Satisfied"],
  disputed: ["Contesté", "Disputed"],
  cancelled: ["Annulé", "Cancelled"],
  withdrawn: ["Retiré", "Withdrawn"],
  removed: ["Supprimé", "Removed"],
  completed: ["Terminé", "Completed"],
  accepted: ["Accepté", "Accepted"],
  waitlisted: ["Liste d’attente", "Waiting list"],
  offered: ["Place proposée", "Seat offered"],
  reconfirm: ["À reconfirmer", "Reconfirm required"],
  registration: ["Inscriptions ouvertes", "Registration open"],
  closed: ["Clôturé", "Closed"],
  interest_closed: ["Intérêts arrêtés", "Interest closed"],
  failed: ["Échec", "Failed"],
  uncertain: ["Résultat incertain", "Uncertain result"],
  unconfigured: ["Non connecté", "Not connected"],
  stale: ["À reconfirmer", "Needs reconfirmation"],
  private: ["Privé", "Private"],
  member: ["Membre", "Member"],
  organizer: ["Organisateur", "Organizer"],
  group_admin: ["Admin du groupe", "Group admin"],
  professional: ["Professionnel", "Partner"],
  title: ["Titre", "Title"],
  description: ["Description", "Description"],
  category: ["Catégorie", "Category"],
  zone: ["Ville ou secteur", "City or area"],
  language: ["Langue choisie", "Chosen language"],
  slots: ["Créneaux souhaités", "Preferred times"],
  budget: ["Budget indicatif (€)", "Indicative budget (€)"],
  deadline: ["Fin des inscriptions / votes", "Registration / voting deadline"],
  capacity: ["Capacité (adultes)", "Capacity (adults)"],
  startsAt: ["Date et heure", "Date and time"],
  endsAt: ["Fin du créneau", "Slot ends"],
  place: ["Lieu", "Location"],
  provider: ["Intervenant", "Provider"],
  price: ["Prix par personne (€)", "Price per person (€)"],
  terms: ["Conditions à accepter", "Terms to accept"],
  activity: ["Activité", "Activity"],
  format: ["Je viens…", "I’m attending…"],
  coordination: [
    "Coordination (visible après confirmation)",
    "Coordination (visible after confirmation)",
  ],
  solo: ["Seul", "On my own"],
  couple: ["En couple", "As a couple"],
  family: ["En famille", "As a family"],
  allFormats: ["Tous les formats", "All formats"],
  duration: ["Durée", "Duration"],
  criteria: ["Critères de recherche", "Search criteria"],
  moveDate: ["Emménagement souhaité", "Preferred move date"],
  sharedWith: ["Professionnels autorisés", "Authorized partners"],
  listingRef: ["Référence de l’annonce Nanba", "Nanba listing reference"],
  sourceUrl: ["Lien de la source", "Source link"],
  confirmedAt: [
    "Disponibilité réellement confirmée le",
    "Availability last confirmed",
  ],
  theme: ["Thème", "Topic"],
  outcome: ["Résultat souhaité", "Desired outcome"],
  skills: ["Compétences (une par ligne)", "Skills (one per line)"],
  maxDuration: ["Durée maximale (minutes)", "Maximum duration (minutes)"],
  maxPerWeek: ["Limite par semaine", "Weekly limit"],
  notifications: [
    "J’accepte les notifications d’entraide",
    "I consent to help notifications",
  ],
  observedAt: ["Observation faite le", "Observed at"],
  evidence: ["Justificatif (lien facultatif)", "Evidence (optional link)"],
  product: ["Produit", "Product"],
  hours: ["Horaires", "Opening hours"],
  event: ["Événement", "Event"],
  other: ["Autre", "Other"],
  period: ["Promotion / période", "Cohort / period"],
  themes: [
    "Thèmes prioritaires (un par ligne)",
    "Priority topics (one per line)",
  ],
  steps: ["Étapes du parcours (une par ligne)", "Journey steps (one per line)"],
  resourceTitle: ["Titre de la ressource", "Resource title"],
  resourceUrl: ["Lien de la ressource", "Resource link"],
  verifiedAt: ["Dernière vérification", "Last verified"],
  teams: [
    "Villes participantes (une par ligne)",
    "Participating cities (one per line)",
  ],
  question: ["Question", "Question"],
  options: ["Réponses proposées (une par ligne)", "Options (one per line)"],
  answer: [
    "Numéro de la bonne réponse (à partir de 1)",
    "Correct option number (starting at 1)",
  ],
  points: ["Points", "Points"],
  sources: [
    "Sources vérifiées (un lien par ligne)",
    "Verified sources (one link per line)",
  ],
  original: ["Texte original", "Original text"],
  translation: ["Version bilingue", "Bilingual version"],
  translationLanguage: ["Langue de la traduction", "Translation language"],
  credit: ["Crédit souhaité", "Author credit"],
  storyType: ["Nature du récit", "Story type"],
  personal: ["Souvenir personnel", "Personal memory"],
  verified_history: ["Information historique vérifiée", "Verified history"],
  publisher: ["Éditeur", "Publisher"],
  frequencyHours: [
    "Fréquence de collecte (heures)",
    "Collection frequency (hours)",
  ],
  freshnessHours: ["Fraîcheur attendue (heures)", "Expected freshness (hours)"],
  official: ["Source officielle vérifiée", "Verified official source"],
  excerpt: ["Extrait justificatif", "Supporting excerpt"],
  publishedAt: [
    "Date de publication (si connue)",
    "Publication date (if known)",
  ],
  eventAt: ["Date de l’événement (si connu)", "Event date (if known)"],
  expiresAt: ["Expiration", "Expires at"],
  dueAt: ["Publication prévue", "Scheduled publication"],
  join: ["M’inscrire", "Join"],
  leave: ["Me désister", "Cancel my registration"],
  acceptTerms: [
    "J’accepte explicitement les conditions et la version affichées.",
    "I explicitly accept the displayed terms and version.",
  ],
  seats: ["Nombre d’adultes", "Number of adults"],
  noChildren: [
    "Les enfants restent sous la responsabilité de leur parent. Aucun profil enfant créé.",
    "Children remain under a parent’s responsibility. No child profiles are created.",
  ],
  remaining: ["places disponibles", "available seats"],
  waitNote: [
    "Si la capacité est atteinte, votre demande passe en liste d’attente. Une place proposée doit être acceptée.",
    "If full, you join the waiting list. An offered seat must be accepted.",
  ],
  calendar: ["Ajouter à mon calendrier", "Add to calendar"],
  saved: ["Enregistré", "Saved"],
  empty: ["Rien pour le moment", "Nothing here yet"],
  emptySub: [
    "Votre prochaine idée pourrait commencer ici.",
    "Your next idea could start here.",
  ],
  search: ["Rechercher dans ce groupe…", "Search this group…"],
  logout: ["Déconnexion", "Log out"],
  switch: ["Changer de profil", "Switch profile"],
  email: ["Adresse e-mail", "Email"],
  password: ["Mot de passe", "Password"],
  login: ["Se connecter", "Sign in"],
  loginTitle: ["On se retrouve ici.", "Find your people here."],
  loginSub: [
    "Vos groupes, vos idées et vos prochains moments ensemble.",
    "Your groups, ideas and next moments together.",
  ],
  demoProfiles: [
    "Explorer avec un profil fictif",
    "Explore with a synthetic profile",
  ],
  noFake: [
    "Données fictives · aucun compte WhatsApp connecté",
    "Synthetic data · no WhatsApp account connected",
  ],
  success: ["Action enregistrée dans Nanba.", "Action saved in Nanba."],
  back: ["Retour", "Back"],
  loading: ["Chargement…", "Loading…"],
  report: ["Signaler", "Report"],
  reason: ["Motif", "Reason"],
  notConnected: [
    "Activation externe nécessaire",
    "External activation required",
  ],
  languagesNote: [
    "Français et anglais disponibles. Tamoul et Tanglish : relecture humaine requise.",
    "French and English available. Tamil and Tanglish require human review.",
  ],
  sponsored: ["Partenariat sponsorisé", "Sponsored partnership"],
};
const t = (k) => copy[k]?.[state.language === "en" ? 1 : 0] || k;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  new Intl.NumberFormat(state.language === "en" ? "en-GB" : "fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n / 100);
const when = (n) =>
  n
    ? new Intl.DateTimeFormat(state.language === "en" ? "en-GB" : "fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Paris",
      }).format(n)
    : "—";
const localDate = (n) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(n)
    .replace(" ", "T");
function fromParis(s) {
  const utc = Date.parse(s + "Z");
  let estimate = utc;
  for (let i = 0; i < 3; i++) {
    const local = Date.parse(localDate(estimate) + "Z");
    estimate += utc - local;
  }
  if (localDate(estimate) !== s)
    throw new Error("invalid_daylight_saving_time");
  return estimate;
}
const icons = {
  home: "M3 10l9-7 9 7v10H3z M9 20v-7h6v7",
  request: "M5 4h14v12H9l-4 4z M9 8h6 M9 12h4",
  meetup:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4",
  housing: "M3 10l9-7 9 7 M5 9v12h14V9 M10 21v-7h4v7",
  help: "M12 20s-9-5-9-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 11-9 11z",
  radar: "M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l8-8 M12 12h.01",
  cohort: "M4 21V5 M4 5c5-6 10 6 16 0v10c-6 6-11-6-16 0",
  challenge:
    "M7 3h10v5c0 7-10 7-10 0z M7 5H3v3c0 4 4 4 4 4 M17 5h4v3c0 4-4 4-4 4 M12 14v7 M7 21h10",
  story: "M12 5c-4-3-9-2-9-2v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2z M12 5v16",
  admin:
    "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M18.4 5.6l-2.1 2.1 M7.7 16.3l-2.1 2.1 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10",
  mine: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M4 21v-2a8 8 0 0 1 16 0v2",
  assistant: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  pin: "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 0 1 16 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  plus: "M12 4v16 M4 12h16",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  check: "M4 12l5 5L20 6",
  source: "M9 15l6-6 M7 17l-2 2a4 4 0 0 1-6-6l6-6 M17 7l2-2a4 4 0 0 1 6 6l-6 6",
  pro: "M3 8h18v13H3z M8 8V3h8v5 M3 13h18 M10 13v3h4v-3",
};
const icon = (k) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[k] || icons.request}"/></svg>`;
const badge = (s, color = "") =>
  `<span class="badge ${color}">${esc(t(s))}</span>`;
const button = (label, action, extra = "", cls = "") =>
  `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${esc(t(label))}</button>`;
const link = (label, path, cls = "secondary") =>
  `<a class="btn ${cls}" href="#${path}">${esc(t(label))}</a>`;
const grp = () => state.me?.groups.find((g) => g.id === state.group);
const isAdmin = () =>
  state.me?.user.platformAdmin || grp()?.role === "group_admin";
const isOrganizer = () => isAdmin() || grp()?.role === "organizer";
const isPro = () => grp()?.role === "professional";
async function api(path, body, method) {
  const response = await fetch("/api" + path, {
    method: method || (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Group-Id": state.group,
      "X-CSRF-Token": state.csrf,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      state.me = null;
      renderLogin();
    }
    throw new Error(data.error || "request_failed");
  }
  return data;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  setTimeout(() => $("#toast").classList.remove("visible"), 4000);
}
const errors = {
  forbidden: [
    "Vous n’avez pas les droits pour cette action.",
    "You do not have permission for this action.",
  ],
  terms_changed: [
    "Les conditions ont changé. Rechargez puis acceptez la nouvelle version.",
    "Terms have changed. Reload and accept the new version.",
  ],
  explicit_acceptance_required: [
    "Votre accord explicite est nécessaire.",
    "Explicit acceptance is required.",
  ],
  group_publications_paused: [
    "Les publications du groupe sont suspendues.",
    "Group publications are paused.",
  ],
  invalid_credentials: [
    "Adresse ou mot de passe incorrect.",
    "Incorrect email or password.",
  ],
  payment_not_configured: [
    "Aucun service de paiement connecté. Aucun paiement réalisé.",
    "No payment service connected. No payment was made.",
  ],
  incompatible_availability: [
    "Ce créneau ne correspond pas à votre profil volontaire.",
    "This time does not match your volunteer profile.",
  ],
  slot_unavailable: [
    "Ce créneau est déjà réservé.",
    "This time slot is already reserved.",
  ],
  author_approval_required: [
    "L’auteur doit valider cette version avant publication.",
    "The author must approve this version before publication.",
  ],
  translation_required: [
    "Ajoutez et relisez la version bilingue avant de valider.",
    "Add and review the bilingual version before approving.",
  ],
  not_found: [
    "Cet élément n’est pas accessible dans votre groupe.",
    "This item is not accessible in your group.",
  ],
  activity_not_started: [
    "L’activité n’a pas encore commencé.",
    "The activity has not started yet.",
  ],
  deadline_not_reached: [
    "Le défi reste ouvert jusqu’à son échéance.",
    "The challenge stays open until its deadline.",
  ],
  profile_exists: [
    "Votre profil volontaire existe déjà.",
    "Your volunteer profile already exists.",
  ],
};
function errorText(e) {
  return (
    errors[e.message]?.[state.language === "en" ? 1 : 0] ||
    `${state.language === "en" ? "Action unavailable" : "Action non disponible"} · ${e.message}`
  );
}
function shell(content) {
  const user = state.me.user,
    nav = [
      "home",
      "request",
      "meetup",
      "housing",
      "help",
      "radar",
      "cohort",
      "challenge",
      "story",
    ];
  $("#app").innerHTML =
    `<div class="shell"><div class="mobile-scrim" data-action="menu"></div><aside class="sidebar"><a class="brand" href="#home" aria-label="Nanba Ensemble"><strong>nanba</strong><span>ENSEMBLE</span></a><div class="nav-label">${t("community")}</div><nav>${nav.map((k) => `<a class="nav-item ${state.route === k ? "active" : ""}" href="#${k}">${icon(k)}${esc(t(k))}</a>`).join("")}</nav><div class="nav-label">${t("account")}</div><nav>${["mine", "assistant", ...(isPro() ? ["pro"] : []), ...(isAdmin() ? ["admin"] : []), ...(state.me.user.platformAdmin && state.me.mode === "waha" ? ["whatsapp"] : [])].map((k) => `<a class="nav-item ${state.route === k ? "active" : ""}" href="#${k}">${icon(k)}${esc(t(k))}</a>`).join("")}</nav><div class="sidebar-bottom"><strong>${t("promise")}</strong>France · Europe/Paris<br>FR / EN · தமிழ்</div></aside><main class="main"><header class="topbar"><div class="top-left"><button class="mobile-menu" data-action="menu" aria-label="Menu">${icon("menu")}</button>${icon("pin")}<select id="group-select" aria-label="Groupe">${state.me.groups.map((g) => `<option value="${esc(g.id)}" ${g.id === state.group ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div><div class="top-right">${state.me.mode === "simulated" ? `<span class="badge orange"><i class="dot"></i><span class="simulation-word">${t("simulated")}</span></span>` : ""}<select id="language-select" class="lang" aria-label="Language"><option ${state.language === "fr" ? "selected" : ""}>FR</option><option ${state.language === "en" ? "selected" : ""}>EN</option></select><span class="avatar">${esc(user.name.slice(0, 2).toUpperCase())}</span><span class="name">${esc(user.name)}</span>${button(state.config.demo ? "switch" : "logout", "logout", "", "secondary small")}</div></header><div class="page">${content}<div class="footer-note">Nanba Ensemble · ${state.me.mode === "simulated" ? t("noFake") : "Communauté privée"} · Europe/Paris</div></div></main></div>`;
  document.documentElement.lang = state.language;
}
function heading(title, sub, cta = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(grp()?.name || "Nanba Ensemble")}</div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${cta}</div>`;
}
function empty(kind) {
  return `<div class="empty">${icon(kind)}<h3>${t("empty")}</h3><p>${t("emptySub")}</p>${canCreate(kind) ? link("create", "new/" + kind) : ""}</div>`;
}
function canCreate(kind) {
  if (["offer", "housing_offer"].includes(kind)) return isPro();
  if (["meetup", "cohort"].includes(kind)) return isOrganizer();
  if (["challenge", "source", "document", "digest"].includes(kind))
    return isAdmin();
  return true;
}
function card(r) {
  const d = r.data;
  return `<article class="card"><div class="card-top"><div class="card-icon ${["request", "story", "help"].includes(r.kind) ? "orange" : ""}">${icon(r.kind)}</div>${badge(d.expired ? "stale" : r.status, ["simulated", "draft", "pending", "proposed", "reconfirm"].includes(r.status) ? "orange" : "")}</div><a href="#detail/${r.id}"><h3>${esc(d.title)}</h3></a><p>${esc(d.description || d.outcome || d.original || d.criteria || d.period || "")}</p>${d.zone ? `<div class="meta">${icon("pin")}${esc(d.zone)}</div>` : ""}${d.startsAt ? `<div class="meta">${esc(when(d.startsAt))}</div>` : ""}${r.kind === "request" ? `<div class="progress"><i data-progress="${Math.min(100, (d.counts.total / d.threshold) * 100)}"></i></div><div class="numbers"><span><b>${d.counts.total} / ${d.threshold}</b> ${t("threshold")}</span>${d.counts.uncertain ? badge("uncertain", "orange") : ""}</div>` : ""}${r.kind === "meetup" ? `<div class="pill-row">${badge(d.language.toUpperCase())}${badge(d.format === "all" ? "allFormats" : d.format)}<small>${d.remaining} ${t("remaining")}</small></div>` : ""}<div class="card-bottom"><span>${r.kind === "offer" || r.kind === "housing_offer" ? money(d.price) : r.kind === "housing" ? badge("private") : r.kind === "radar" ? esc(d.confirmation === "member" ? (state.language === "en" ? "Member report" : "Signalé par un membre") : d.confirmation === "official" ? (state.language === "en" ? "Official source" : "Source officielle") : state.language === "en" ? "Confirmed by organizer" : "Confirmé par l’organisateur") : r.kind === "story" ? esc(d.credit) : esc(t(r.kind))}</span><a class="btn link" href="#detail/${r.id}">${t("details")} ${icon("arrow")}</a></div></article>`;
}
function progressWidths() {
  document
    .querySelectorAll("[data-progress]")
    .forEach((el) => (el.style.width = el.dataset.progress + "%"));
}
async function home() {
  const d = await api("/home");
  shell(
    `${heading(t("hello") + ", " + state.me.user.name + ".", t("homeSub"), link("propose", "new/request", "orange"))}${state.config.demo ? `<div class="notice">${t("demoNote")}</div>` : ""}<section class="hero"><div class="hero-copy"><div class="eyebrow">${state.language === "en" ? "FROM AN IDEA TO A SHARED MOMENT" : "D’UNE IDÉE À UN MOMENT PARTAGÉ"}</div><h2>${t("heroTitle")}</h2><p>${t("heroSub")}</p>${link("discover", "request", "")}</div><div class="hero-art" aria-hidden="true"><div class="circle"></div><div class="circle two"></div><div class="circle three"></div><div class="hero-note"><strong>${state.language === "en" ? "It starts with us." : "Ça commence avec nous."}</strong><div class="avatars"><span class="avatar">A</span><span class="avatar">P</span><span class="avatar">J</span><span class="avatar">+</span></div>${t("welcome")}</div><div class="little-tag">${state.language === "en" ? "An idea. A few people." : "Une idée. Quelques personnes."}</div></div></section><div class="dashboard-grid"><div><div class="section-head"><h2>${t("discover")}</h2><a href="#request">${t("all")} →</a></div><div class="cards">${d.requests.slice(0, 2).map(card).join("") || empty("request")}${d.meetups.slice(0, 1).map(card).join("")}</div><div class="modules">${["help", "cohort", "challenge", "story"].map((k) => `<a class="module-tile" href="#${k}">${icon(k)}<strong>${t(k)}</strong></a>`).join("")}</div></div><aside class="rail"><div class="rail-box"><h3>${t("next")}</h3>${
      d.meetups
        .slice(0, 2)
        .map(
          (r) =>
            `<a class="rail-item" href="#detail/${r.id}"><strong>${esc(r.data.title)}</strong><small>${when(r.data.startsAt)}</small><p>${r.data.remaining} ${t("remaining")} · ${esc(r.data.zone)}</p></a>`,
        )
        .join("") || `<p>${t("empty")}</p>`
    }</div><div class="rail-box tint"><h3>${t("latest")}</h3>${
      d.radar
        .slice(0, 2)
        .map(
          (r) =>
            `<a href="#detail/${r.id}"><strong>${esc(r.data.title)}</strong><p>${esc(r.data.place)}</p><small>${t("expiresAt")} : ${when(r.data.expiresAt)}</small></a>`,
        )
        .join("") || `<p>${t("empty")}</p>`
    }</div></aside></div>`,
  );
  progressWidths();
}
const subtitles = {
  request: [
    "Rassemblons les envies. Une offre confirmée viendra ensuite.",
    "Find shared interests. A confirmed offer comes next.",
  ],
  meetup: [
    "Quatre à six personnes, des préférences choisies, une vraie rencontre.",
    "Four to six people, shared preferences, a real gathering.",
  ],
  housing: [
    "Votre recherche reste privée. Vous choisissez les professionnels qui peuvent la lire.",
    "Your search is private. You choose which partners can read it.",
  ],
  help: [
    "Un petit coup de main, un créneau choisi, l’accord des deux personnes.",
    "A helping hand, an agreed time, consent from both people.",
  ],
  radar: [
    "Une observation, sa provenance et une date de fin de validité.",
    "An observation, its source and its expiry date.",
  ],
  cohort: [
    "Avancez à votre rythme. Votre progression reste personnelle.",
    "Move at your own pace. Your progress stays private.",
  ],
  challenge: [
    "Des règles annoncées, des réponses vérifiées, des points calculés par Nanba.",
    "Published rules, verified answers and scores calculated by Nanba.",
  ],
  story: [
    "Vos mots, vos traditions. Vous validez chaque version avant de la partager.",
    "Your words, your traditions. Approve each version before sharing it.",
  ],
};
async function listing(kind) {
  state.items = await api("/records?kind=" + kind);
  const extra =
    kind === "help"
      ? `${link("volunteer", "volunteer")}${link("create", "new/volunteer")}`
      : kind === "meetup"
        ? button(
            state.language === "en"
              ? "Find a gathering"
              : "Trouver ma rencontre",
            "match",
            "",
            "secondary",
          )
        : kind === "housing"
          ? `<div class="notice green">${state.language === "en" ? "Only your chosen partners can see your search. Group administrators do not have access." : "Seuls les professionnels choisis accèdent à votre recherche. Les administrateurs du groupe n’y ont pas accès."}</div>`
          : "";
  shell(
    `${heading(t(kind), subtitles[kind]?.[state.language === "en" ? 1 : 0] || "", canCreate(kind) ? link("create", "new/" + kind, "orange") : "")}<div class="toolbar"><input id="filter" type="search" placeholder="${t("search")}" aria-label="${t("search")}">${kind === "radar" ? button(state.language === "en" ? "Current only" : "Informations actuelles", "current-radar", "", "secondary") : ""}${extra}</div><div id="items" class="cards">${state.items.map(card).join("") || empty(kind)}</div>`,
  );
  progressWidths();
}
const field = (key, type = "text", value = "", opts = {}) => {
  const label = opts.label || t(key),
    id = "f-" + key;
  let input;
  if (type === "select")
    input = `<select id="${id}" name="${key}" ${opts.required === false ? "" : "required"}>${opts.options.map((o) => `<option value="${esc(Array.isArray(o) ? o[0] : o)}" ${String(value) === (Array.isArray(o) ? o[0] : o) ? "selected" : ""}>${esc(Array.isArray(o) ? o[1] : t(o))}</option>`).join("")}</select>`;
  else if (type === "textarea")
    input = `<textarea id="${id}" name="${key}" ${opts.required === false ? "" : "required"} maxlength="${opts.max || 5000}">${esc(value)}</textarea>`;
  else if (type === "checkbox")
    input = `<input id="${id}" name="${key}" type="checkbox" ${value ? "checked" : ""} ${opts.required ? "required" : ""}>`;
  else
    input = `<input id="${id}" name="${key}" type="${type}" value="${esc(value)}" ${opts.required === false ? "" : "required"} ${type === "number" ? `min="${opts.min ?? 0}" max="${opts.max ?? 100000}" step="${opts.step ?? 1}"` : ""} ${opts.maxlength ? `maxlength="${opts.maxlength}"` : ""}>`;
  return `<div class="field ${type === "textarea" || opts.wide ? "wide" : ""} ${type === "checkbox" ? "checkbox" : ""}">${type !== "checkbox" ? `<label for="${id}">${esc(label)}</label>` : ""}${input}${type === "checkbox" ? `<label for="${id}">${esc(label)}</label>` : ""}${opts.hint ? `<small>${esc(opts.hint)}</small>` : ""}</div>`;
};
const langs = [
  ["fr", "Français"],
  ["en", "English"],
  ["ta", "தமிழ் · à relire"],
  ["tanglish", "Tanglish · à relire"],
];
const lines = (s) =>
  String(s || "")
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
function formData(form) {
  const data = {};
  new FormData(form).forEach((v, k) => (data[k] = v));
  form
    .querySelectorAll("input[type=checkbox]")
    .forEach((el) => (data[el.name] = el.checked));
  form
    .querySelectorAll("input[type=number]")
    .forEach(
      (el) => (data[el.name] = el.value === "" ? null : Number(el.value)),
    );
  form
    .querySelectorAll("input[type=datetime-local]")
    .forEach((el) => (data[el.name] = el.value ? fromParis(el.value) : null));
  return data;
}
function dialog(title, fields, submit, label = "save", note = "") {
  const modal = $("#modal");
  modal.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button class="close" data-action="close" aria-label="${t("close")}">×</button></div>${note ? `<div class="notice">${esc(note)}</div>` : ""}<form id="dialog-form"><div class="form-grid">${fields}</div><p class="form-error" role="alert"></p><div class="form-actions">${button("cancel", "close", "", "secondary")}<button class="btn" type="submit">${esc(t(label))}</button></div></form>`;
  modal.showModal();
  $("#dialog-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
      await submit(formData(e.target));
      modal.close();
      await route();
      toast(t("success"));
    } catch (err) {
      $("#dialog-form .form-error").textContent = errorText(err);
    } finally {
      btn.disabled = false;
    }
  };
}
async function createForm(kind, parentId) {
  if (!canCreate(kind)) throw new Error("forbidden");
  const now = Date.now(),
    future = localDate(now + 7 * 86400000);
  let fields = "",
    organizations = [];
  const common = field("title", "text", "", { maxlength: 160 });
  if (kind === "request")
    fields =
      common +
      field("category", "select", "Cuisine", {
        options: [
          "Cuisine",
          "Sortie",
          "Sport",
          "Culture",
          "Formation",
          "Autre",
        ],
      }) +
      field("description", "textarea") +
      field("zone", "text", grp().zone) +
      field("language", "select", "fr", { options: langs }) +
      field("slots") +
      field("budget", "number", "", { required: false, step: 0.01 }) +
      field("threshold", "number", 6, { min: 2, max: 500 }) +
      field("deadline", "datetime-local", future);
  if (kind === "meetup")
    fields =
      common +
      field("activity", "select", "Café", {
        options: ["Café", "Balade", "Cinéma", "Déjeuner", "Sport", "Culture"],
      }) +
      field("description", "textarea") +
      field("zone", "text", grp().zone) +
      field("place") +
      field("language", "select", "fr", { options: langs }) +
      field("format", "select", "all", {
        options: [
          ["all", t("allFormats")],
          ["solo", t("solo")],
          ["couple", t("couple")],
          ["family", t("family")],
        ],
      }) +
      field("startsAt", "datetime-local", future) +
      field("capacity", "number", 6, { min: 2, max: 30 }) +
      field("coordination", "textarea");
  if (kind === "offer")
    fields =
      common +
      field("provider", "text", state.me.user.name) +
      field("description", "textarea") +
      field("place") +
      field("startsAt", "datetime-local", localDate(now + 10 * 86400000)) +
      field("price", "number", 25, { step: 0.01 }) +
      field("capacity", "number", 10, { min: 1, max: 500 }) +
      field("deadline", "datetime-local", future) +
      field("terms", "textarea") +
      field("sponsored", "checkbox", false);
  if (kind === "housing") {
    organizations = await api("/organizations");
    fields =
      common +
      field("zone", "text", grp().zone) +
      field("budget", "number", 550, { step: 0.01 }) +
      field("moveDate", "datetime-local", localDate(now + 30 * 86400000)) +
      field("duration", "text", "6 mois") +
      field("criteria", "textarea") +
      `<div class="wide"><label>${t("sharedWith")}</label>${organizations.map((o) => field("org_" + o.id, "checkbox", false, { label: o.name })).join("")}<small>${state.language === "en" ? "No selection means your search stays visible only to you." : "Sans sélection, votre recherche reste visible uniquement par vous."}</small></div>`;
  }
  if (kind === "housing_offer")
    fields =
      common +
      field("listingRef") +
      field("source", "url", "", { label: t("sourceUrl") }) +
      field("description", "textarea") +
      field("price", "number", 500, { step: 0.01 }) +
      field("confirmedAt", "datetime-local", localDate(now));
  if (kind === "help")
    fields =
      common +
      field("theme", "select", "CV", {
        options: ["CV", "Conversation", "Informatique", "Orientation", "Autre"],
      }) +
      field("outcome", "textarea") +
      field("language", "select", "fr", { options: langs }) +
      field("duration", "number", 20, { min: 5, max: 60 }) +
      field("startsAt", "datetime-local", future);
  if (kind === "volunteer")
    fields =
      field("skills", "textarea", "CV\nConversation") +
      field("language", "select", "fr", { options: langs }) +
      field("maxDuration", "number", 20, { min: 5, max: 60 }) +
      field("maxPerWeek", "number", 2, { min: 1, max: 10 }) +
      field("startsAt", "datetime-local", future) +
      field(
        "endsAt",
        "datetime-local",
        localDate(now + 7 * 86400000 + 7200000),
      ) +
      field("notifications", "checkbox", false, { wide: true });
  if (kind === "radar")
    fields =
      common +
      field("category", "select", "product", {
        options: ["product", "hours", "event", "other"],
      }) +
      field("description", "textarea") +
      field("zone", "text", grp().zone) +
      field("place") +
      field("observedAt", "datetime-local", localDate(now)) +
      field("evidence", "url", "", { required: false });
  if (kind === "cohort")
    fields =
      common +
      field("zone", "text", grp().zone) +
      field("period") +
      field("capacity", "number", 30, { min: 1, max: 200 }) +
      field("themes", "textarea", "Se repérer\nRencontrer du monde") +
      field("steps", "textarea", "Choisir mon quartier\nTrouver une activité") +
      field("resourceTitle", "text", "Portail des démarches") +
      field("resourceUrl", "url", "https://www.service-public.gouv.fr/") +
      field("verifiedAt", "datetime-local", localDate(now));
  if (kind === "challenge")
    fields =
      common +
      field("description", "textarea") +
      field("teams", "textarea", "Paris\nLyon") +
      field("deadline", "datetime-local", future) +
      field("question", "textarea") +
      field("options", "textarea") +
      field("answer", "number", 1, { min: 1, max: 10 }) +
      field("points", "number", 1, { min: 1, max: 100 }) +
      field("sources", "textarea");
  if (kind === "story")
    fields =
      common +
      field("credit", "text", state.me.user.name) +
      field("language", "select", "fr", { options: langs }) +
      field("translationLanguage", "select", "en", {
        options: langs.filter((l) => l[0] !== "tanglish"),
      }) +
      field("original", "textarea", "", { max: 1500 }) +
      field("translation", "textarea", "", { max: 1500, required: false }) +
      field("storyType", "select", "personal", {
        options: ["personal", "verified_history"],
      });
  if (kind === "source")
    fields =
      common +
      field("url", "url", "", { label: t("sourceUrl") }) +
      field("publisher") +
      field("format", "select", "json", {
        label: state.language === "en" ? "Feed format" : "Format du flux",
        options: [
          ["json", "JSON Feed"],
          ["rss", "RSS / Atom"],
        ],
      }) +
      field("category", "select", "culture", {
        options: ["culture", "events", "administrative", "other"],
      }) +
      field("zone", "text", grp().zone) +
      field("language", "select", "fr", { options: langs.slice(0, 3) }) +
      field("frequencyHours", "number", 24, { min: 1, max: 720 }) +
      field("freshnessHours", "number", 168, { min: 1, max: 8760 }) +
      field("official", "checkbox", false);
  if (kind === "document")
    fields =
      common +
      field("url", "url", "", { label: t("sourceUrl") }) +
      field("publisher") +
      field("excerpt", "textarea", "", { max: 2500 }) +
      field("zone", "text", grp().zone) +
      field("category", "select", "culture", {
        options: ["culture", "events", "administrative", "other"],
      }) +
      field("publishedAt", "datetime-local", "", { required: false }) +
      field("eventAt", "datetime-local", "", { required: false }) +
      field("expiresAt", "datetime-local", future) +
      field("official", "checkbox", false);
  if (kind === "digest") {
    const docs = (await api("/records?kind=document")).filter(
      (d) => d.status === "verified" && d.data.expiresAt > Date.now(),
    );
    fields =
      common +
      field("dueAt", "datetime-local", localDate(now + 3600000)) +
      `<div class="wide">${docs.map((d) => field("doc_" + d.id, "checkbox", false, { label: d.data.title })).join("") || t("empty")}</div>`;
  }
  shell(
    `${heading(t("create") + " · " + t(kind), "", link("back", parentId ? "detail/" + parentId : kind))}<div class="panel-form"><form id="create-form"><div class="form-grid">${fields}</div><p class="form-error" role="alert"></p><div class="notice green">${kind === "story" ? t("languagesNote") : kind === "housing" ? t("private") : state.language === "en" ? "Dates and times use Europe/Paris." : "Dates et heures en Europe/Paris."}</div><div class="form-actions"><button class="btn orange" type="submit">${t("save")}</button></div></form></div>`,
  );
  $("#create-form").onsubmit = async (e) => {
    e.preventDefault();
    e.submitter.disabled = true;
    try {
      const b = formData(e.target);
      b.kind = kind;
      if (parentId) b.requestId = parentId;
      for (const k of ["budget", "price"])
        if (b[k] != null) b[k] = Math.round(b[k] * 100);
      if (kind === "housing")
        b.sharedWith = organizations
          .filter((o) => b["org_" + o.id])
          .map((o) => o.id);
      if (kind === "volunteer") {
        b.skills = lines(b.skills);
        b.languages = [b.language];
        b.slots = [{ start: b.startsAt, end: b.endsAt }];
      }
      if (kind === "cohort") {
        b.themes = lines(b.themes);
        b.steps = lines(b.steps);
        b.resources = [
          {
            title: b.resourceTitle,
            url: b.resourceUrl,
            verifiedAt: b.verifiedAt,
          },
        ];
      }
      if (kind === "challenge") {
        b.teams = lines(b.teams);
        b.questions = [
          {
            prompt: b.question,
            options: lines(b.options),
            answer: b.answer - 1,
            points: b.points,
          },
        ];
        b.sources = lines(b.sources);
      }
      if (kind === "digest")
        b.documentIds = Object.keys(b)
          .filter((k) => k.startsWith("doc_") && b[k])
          .map((k) => k.slice(4));
      const r = await api("/records", b);
      location.hash = "detail/" + r.id;
      toast(t("saved"));
    } catch (err) {
      $("#create-form .form-error").textContent = errorText(err);
      e.submitter.disabled = false;
    }
  };
}
const fact = (label, value) =>
  `<div class="fact"><span>${esc(t(label))}</span><strong>${esc(value)}</strong></div>`;
const act = (label, action, body = {}, cls = "secondary") =>
  button(
    label,
    "record-action",
    `data-name="${action}" data-body="${esc(JSON.stringify(body))}"`,
    cls,
  );
async function detail(id) {
  const r = await api("/records/" + id);
  state.record = r;
  const d = r.data,
    owner = r.owner_id === state.me.user.id;
  let facts = "",
    main = "",
    actions = "";
  for (const k of [
    "zone",
    "place",
    "language",
    "category",
    "format",
    "period",
    "duration",
  ])
    if (d[k]) facts += fact(k, t(d[k]));
  for (const k of [
    "startsAt",
    "deadline",
    "expiresAt",
    "observedAt",
    "confirmedAt",
    "moveDate",
  ])
    if (d[k]) facts += fact(k, when(d[k]));
  if (d.price != null) facts += fact("price", money(d.price));
  if (d.budget != null) facts += fact("budget", money(d.budget));
  if (d.remaining != null) facts += fact("remaining", d.remaining);
  if (d.sponsored) facts += badge("sponsored", "orange");
  main += `<div class="pill-row">${badge(r.status, ["draft", "simulated", "proposed", "pending"].includes(r.status) ? "orange" : "")}${["housing", "help"].includes(r.kind) ? badge("private") : ""}</div><p class="body-text">${esc(d.description || d.outcome || d.criteria || "")}</p>`;
  if (r.kind === "request") {
    main += `<div class="flow"><span class="on">1 · ${state.language === "en" ? "Idea" : "Besoin"}</span><span class="${d.poll ? "on" : ""}">2 · ${state.language === "en" ? "Interest" : "Intérêt"}</span><span class="${d.offers.some((o) => o.status === "confirmed") ? "on" : ""}">3 · ${t("offer")}</span><span>4 · ${t("join")}</span></div><h2>${d.counts.total} / ${d.threshold} ${t("threshold")}</h2><div class="progress"><i data-progress="${Math.min(100, (d.counts.total / d.threshold) * 100)}"></i></div><p>${d.counts.verified} ${t("verified")} · ${d.counts.provisional} ${t("provisional")}</p><div class="notice green">${t("voteNote")}</div>${d.thresholdReached ? `<div class="notice">${state.language === "en" ? "Interest threshold reached. A partner still needs to confirm an offer." : "Seuil d’intérêt atteint. Une offre doit encore être confirmée par un professionnel."}</div>` : ""}<h2>${t("offer")}</h2>${d.offers.map((o) => `<div class="offer-box"><h3>${esc(o.data.title)}</h3><p>${money(o.data.price)} · ${when(o.data.startsAt)} · ${t(o.status)}</p>${link("view", "detail/" + o.id)}</div>`).join("") || `<p>${t("empty")}</p>`}`;
    actions += act(
      d.interested ? "withdrawInterest" : "interest",
      "interest",
      { active: !d.interested },
      "",
    );
    if (isAdmin() && !d.poll)
      actions += act(
        state.language === "en"
          ? "Approve WhatsApp poll"
          : "Valider le sondage WhatsApp",
        "publish_poll",
        {},
      );
    if (isAdmin() && d.poll?.status === "simulated")
      actions += button(
        state.language === "en" ? "Simulate a vote" : "Simuler un vote",
        "simulate",
      );
    if (isPro())
      actions += link(
        state.language === "en" ? "Prepare an offer" : "Préparer une offre",
        "new/offer/" + id,
      );
    if (owner) actions += act("cancel", "cancel");
    facts += fact("slots", d.slots);
    if (d.poll)
      facts += fact(
        state.language === "en" ? "Poll" : "Sondage",
        t(d.poll.status),
      );
  }
  if (["offer", "meetup", "cohort"].includes(r.kind)) {
    if (d.enrollment)
      main += `<div class="notice green">${t("join")} : ${t(d.enrollment.status)}${d.enrollment.offered_until ? " · " + when(d.enrollment.offered_until) : ""}</div>`;
    actions += button(
      d.enrollment?.status === "offered" || d.enrollment?.status === "reconfirm"
        ? state.language === "en"
          ? "Accept this seat"
          : "Accepter cette place"
        : "join",
      "enroll",
    );
    if (d.enrollment) actions += act("leave", "leave");
    if (d.startsAt)
      actions += button(
        "calendar",
        "download",
        `data-path="/records/${id}/calendar" data-file="nanba-evenement.ics"`,
        "secondary",
      );
  }
  if (r.kind === "offer") {
    main += `<h2>${t("terms")}</h2><p>${esc(d.terms)}</p><small>Version ${r.version} · ${t("provider")} : ${esc(d.provider)}</small>`;
    if (owner) {
      if (r.status === "draft")
        actions += act(
          state.language === "en"
            ? "I confirm this offer"
            : "Je confirme cette offre",
          "confirm",
          {},
          "",
        );
      actions += button(
        state.language === "en" ? "Revise terms" : "Modifier les conditions",
        "revise-offer",
      );
      actions += act("cancel", "cancel") + act("completed", "complete");
    }
    if (d.enrollment?.status === "confirmed")
      actions += button(
        state.language === "en" ? "Payment status" : "État du paiement",
        "payment",
        "",
        "secondary",
      );
  }
  if (r.kind === "meetup") {
    facts += fact("organizer", d.organizer);
    if (d.coordination)
      main += `<h2>${t("coordination")}</h2><p>${esc(d.coordination)}</p>`;
    if (owner)
      actions += act("cancel", "cancel") + act("completed", "complete");
  }
  if (["offer", "meetup", "cohort"].includes(r.kind) && isAdmin())
    actions += act(
      state.language === "en"
        ? "Prepare WhatsApp link"
        : "Préparer le lien WhatsApp",
      "publish_link",
    );
  if (r.kind === "housing") {
    facts += fact("sharedWith", d.sharedWith.length);
    if (owner)
      actions +=
        button(
          state.language === "en" ? "Manage sharing" : "Gérer le partage",
          "consent",
        ) +
        act(
          r.status === "active" ? "suspended" : "active",
          r.status === "active" ? "suspend" : "resume",
        ) +
        act("satisfied", "satisfy");
    if (isPro())
      actions += link(
        state.language === "en" ? "Propose a home" : "Proposer un logement",
        "new/housing_offer/" + id,
      );
    const offers = (await api("/records?kind=housing_offer")).filter(
      (o) => o.data.requestId === id,
    );
    main += `<h2>${t("housing_offer")}</h2>${offers.map(card).join("") || `<p>${t("empty")}</p>`}`;
  }
  if (r.kind === "housing_offer") {
    main += `<p><a class="link-source" href="${esc(d.source)}" target="_blank" rel="noopener">${esc(d.source)}</a></p>${d.stale ? `<div class="notice">${state.language === "en" ? "Availability is old and needs confirmation." : "Disponibilité ancienne : à reconfirmer avant toute démarche."}</div>` : ""}<p>${d.contactRequested ? (state.language === "en" ? "Contact requested by the member." : "Le membre a demandé une prise de contact.") : ""}</p>`;
    if (owner) actions += act("stale", "reconfirm");
    else
      actions +=
        act("interest", "interest") +
        act(
          state.language === "en" ? "Request contact" : "Demander un contact",
          "contact",
        );
  }
  if (r.kind === "volunteer") {
    main += `<p>${d.skills.map(esc).join(" · ")}<br>${d.languages.map(esc).join(" · ")}</p>${d.slots.map((s) => fact("slots", when(s.start) + " → " + when(s.end))).join("")}`;
    facts +=
      fact("maxDuration", d.maxDuration + " min") +
      fact("maxPerWeek", d.maxPerWeek);
    if (owner)
      actions += act(
        r.status === "active" ? "paused" : "active",
        r.status === "active" ? "pause" : "resume",
      );
  }
  if (r.kind === "help") {
    facts += fact("theme", d.theme) + fact("duration", d.duration + " min");
    main += `<div class="notice green">${state.language === "en" ? "Volunteer support only. Both people must agree." : "Entraide bénévole. L’accord des deux personnes est nécessaire."}</div>`;
    if (r.status === "open" && !owner)
      actions += act(
        state.language === "en" ? "I can help" : "Je me propose",
        "volunteer",
        {},
        "",
      );
    if (owner && r.status === "proposed")
      actions +=
        act(
          state.language === "en" ? "Accept this help" : "Accepter cette aide",
          "accept",
          {},
          "",
        ) + act(state.language === "en" ? "Decline" : "Décliner", "decline");
    if (owner || d.volunteerId === state.me.user.id)
      actions += act("cancel", "cancel") + act("completed", "complete");
  }
  if (r.kind === "radar") {
    main += `<div class="notice ${d.expired ? "" : "green"}">${d.expired ? (state.language === "en" ? "Expired information. Do not treat as current." : "Information expirée. Ne pas la considérer comme actuelle.") : d.confirmation === "member" ? "Signalé par un membre" : d.confirmation === "official" ? "Source officielle" : "Confirmé par un organisateur"}</div>${d.evidence ? `<a class="link-source" href="${esc(d.evidence)}" target="_blank" rel="noopener">${t("evidence")}</a>` : ""}`;
    actions += button(
      state.language === "en"
        ? "Dispute information"
        : "Contester l’information",
      "dispute",
    );
    if (isAdmin())
      actions +=
        act("publish", "publish", {}, "") +
        button(
          state.language === "en"
            ? "Confirm with evidence"
            : "Confirmer avec justificatif",
          "confirm-radar",
        ) +
        button(
          state.language === "en" ? "Correct" : "Corriger",
          "correct-radar",
        ) +
        act("removed", "remove");
  }
  if (r.kind === "cohort") {
    const activities = (await api("/home")).mine.filter(
      (e) =>
        ["confirmed", "completed"].includes(e.status) && e.kind === "meetup",
    );
    const p = d.progress || {};
    main += `<h2>${state.language === "en" ? "My private journey" : "Mon parcours privé"}</h2><form id="progress-form"><ul class="checklist">${d.steps.map((s, i) => `<li><label><input type="checkbox" name="step_${i}" ${(p.completed || []).includes(s) ? "checked" : ""}>${esc(s)}</label></li>`).join("")}</ul><h2>${state.language === "en" ? "My resources" : "Mes ressources"}</h2>${d.resources.map((s, i) => `<div class="field checkbox"><input type="checkbox" name="resource_${i}" ${(p.saved || []).includes(s.url) ? "checked" : ""}><div><a class="link-source" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><small> · ${when(s.verifiedAt)}</small></div></div>`).join("")}<h2>${state.language === "en" ? "My activities" : "Mes activités"}</h2>${activities.map((e) => field("activity_" + e.record_id, "checkbox", (p.activities || []).includes(e.record_id), { label: e.title, wide: true })).join("")}${link("meetup", "meetup")}${field("theme", "select", p.theme || d.themes[0], { options: d.themes })}${field("mentor", "checkbox", p.mentor, { label: state.language === "en" ? "I would like to help a future cohort" : "Je souhaite aider une prochaine promotion", wide: true })}<p class="form-error"></p><button class="btn" type="submit">${t("save")}</button></form>`;
    facts += fact(
      state.language === "en" ? "Facilitator" : "Animateur",
      d.facilitator,
    );
  }
  if (r.kind === "challenge") {
    main += `<div class="notice green">${esc(d.rule)} · Version ${d.rulesVersion}</div>`;
    if (r.status === "registration")
      actions += button("join", "join-challenge");
    if (r.status === "open")
      main += `<form id="answers-form">${d.questions.map((q, i) => field("q_" + i, "select", 0, { label: q.prompt, options: q.options.map((o, j) => [String(j), o]) })).join("")}<p class="form-error"></p><button class="btn" type="submit">${state.language === "en" ? "Submit once" : "Valider mes réponses une fois"}</button></form>`;
    if (r.status === "closed") {
      actions += button(
        state.language === "en"
          ? "Download results card"
          : "Télécharger la carte des résultats",
        "download",
        `data-path="/records/${id}/card" data-file="nanba-resultats.svg"`,
        "secondary",
      );
      const results = await api("/records/" + id + "/leaderboard");
      main += `<h2>${state.language === "en" ? "Final results" : "Résultats définitifs"}</h2>${results.map((x, i) => `<div class="result-row"><strong>${i + 1}. ${esc(x.team)}</strong><span>${x.score.toFixed(2)} · ${x.points} / ${x.participants}</span></div>`).join("")}`;
    }
    if (d.entry)
      main += `<p>${esc(d.entry.team)} · ${d.entry.submitted_at ? t("saved") : t("join")}</p>`;
    if (isAdmin()) {
      if (r.status === "draft")
        actions += act(
          state.language === "en"
            ? "Facts verified: open registration"
            : "Faits vérifiés : ouvrir les inscriptions",
          "verify",
          { verified: true },
        );
      if (r.status === "registration")
        actions += act(
          state.language === "en"
            ? "Freeze teams and start"
            : "Figer les équipes et démarrer",
          "open",
        );
      if (r.status === "open") actions += act("closed", "close");
      if (r.status === "closed")
        actions += button(
          state.language === "en" ? "Correct answer key" : "Corriger le barème",
          "correct-challenge",
        );
    }
    actions += button(
      state.language === "en" ? "Dispute a result" : "Contester un résultat",
      "dispute",
    );
  }
  if (r.kind === "story") {
    main += `<div class="story-columns"><div><small>${esc(d.language?.toUpperCase())}</small><p>${esc(d.original)}</p></div><div><small>${esc(d.translationLanguage?.toUpperCase())}</small><p>${esc(d.translation || t("empty"))}</p></div></div><p>— ${esc(d.credit)}</p>${d.translationUncertain ? `<div class="notice">${state.language === "en" ? "Translation awaiting author review." : "Traduction en attente de relecture par l’auteur."}</div>` : ""}`;
    if (owner) {
      if (r.status !== "withdrawn")
        actions += button(
          state.language === "en" ? "Edit draft" : "Modifier le brouillon",
          "edit-story",
        );
      if (r.status === "draft")
        actions += button(
          state.language === "en"
            ? "Approve text & audiences"
            : "Valider le texte et les publics",
          "approve-story",
        );
      actions += act("withdrawn", "withdraw");
    }
    if (isAdmin() && r.status === "approved")
      actions += act("publish", "publish", {}, "");
    if (
      isAdmin() &&
      r.status === "published" &&
      d.audiences.includes("whatsapp")
    )
      actions += act(
        state.language === "en"
          ? "Prepare WhatsApp publication"
          : "Préparer la publication WhatsApp",
        "share",
      );
    if (r.status === "published")
      actions += button(
        state.language === "en"
          ? "Download bilingual card"
          : "Télécharger la carte bilingue",
        "download",
        `data-path="/records/${id}/card" data-file="nanba-histoire.svg"`,
        "secondary",
      );
  }
  if (r.kind === "source") {
    main += `<p><a class="link-source" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.url)}</a></p>`;
    facts +=
      fact("publisher", d.publisher) +
      fact(
        state.language === "en" ? "Last collection" : "Dernière collecte",
        when(d.lastCollected),
      );
    if (d.lastError) main += `<div class="notice">${esc(d.lastError)}</div>`;
    actions +=
      button(
        state.language === "en" ? "Collect now" : "Collecter maintenant",
        "collect",
      ) +
      act(
        r.status === "active" ? "paused" : "active",
        r.status === "active" ? "pause" : "resume",
      );
  }
  if (r.kind === "document") {
    main += `<p>${esc(d.excerpt)}</p><p><a class="link-source" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.url)}</a></p>`;
    facts +=
      fact("publisher", d.publisher) +
      fact("publishedAt", when(d.publishedAt)) +
      fact("verifiedAt", when(d.verifiedAt));
    if (isAdmin())
      actions +=
        act(
          state.language === "en"
            ? "Verify this source"
            : "Valider cette source",
          "verify",
          {},
          "",
        ) + act("removed", "remove");
  }
  if (r.kind === "digest") {
    main += `<h2>${state.language === "en" ? "Publication preview" : "Aperçu de publication"}</h2>`;
    for (const docId of d.documentIds) {
      const doc = await api("/records/" + docId);
      main += `<div class="offer-box"><h3>${esc(doc.data.title)}</h3><p>${esc(doc.data.url)}</p></div>`;
    }
    facts += fact("dueAt", when(d.dueAt));
    actions += act("publish", "publish", {}, "");
  }
  if (r.status === "completed")
    actions += button(
      state.language === "en" ? "Leave feedback" : "Donner mon avis",
      "feedback",
    );
  shell(
    `${heading(d.title || t(r.kind), "", link("back", r.kind === "offer" ? "request" : r.kind))}<div class="detail-layout"><article class="detail-main">${main}</article><aside class="detail-side"><div class="eyebrow">${t(r.kind)}</div>${facts}<div class="actions">${actions}</div></aside></div>`,
  );
  progressWidths();
  if ($("#progress-form"))
    $("#progress-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const b = formData(e.target);
        await api("/records/" + id + "/action", {
          action: "progress",
          completed: d.steps.filter((s, i) => b["step_" + i]),
          saved: d.resources
            .filter((s, i) => b["resource_" + i])
            .map((s) => s.url),
          activities: Object.keys(b)
            .filter((k) => k.startsWith("activity_") && b[k])
            .map((k) => k.slice(9)),
          mentor: b.mentor,
          theme: b.theme,
        });
        toast(t("saved"));
      } catch (err) {
        $("#progress-form .form-error").textContent = errorText(err);
      }
    };
  if ($("#answers-form"))
    $("#answers-form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const b = formData(e.target);
        await api("/records/" + id + "/action", {
          action: "answer",
          answers: d.questions.map((q, i) => Number(b["q_" + i])),
        });
        await route();
        toast(t("saved"));
      } catch (err) {
        $("#answers-form .form-error").textContent = errorText(err);
      }
    };
}
async function adminPage() {
  const d = await api("/admin");
  shell(
    `${heading(t("admin"), state.language === "en" ? "Review, authorize and follow every publication." : "Relire, autoriser et suivre chaque publication.", button(state.language === "en" ? "Process queue" : "Traiter la file", "process"))}<div class="notice">${state.me.mode === "simulated" ? t("simulation") : "WAHA " + d.wahaVersion} · ${t(d.health.status)} · ${state.language === "en" ? "AI and payments require separate connections." : "IA et paiement nécessitent leurs connexions propres."}</div><div class="stat-grid">${[
      [d.metrics.pending, "pending"],
      [d.metrics.uncertain, "uncertain"],
      [d.metrics.confirmedRegistrations, "join"],
      [
        d.metrics.decryptFailures,
        state.language === "en" ? "Undecrypted votes" : "Votes non déchiffrés",
      ],
    ]
      .map(
        ([v, k]) =>
          `<div class="stat"><strong>${v}</strong><span>${t(k)}</span></div>`,
      )
      .join(
        "",
      )}</div><div class="toolbar">${button(d.group.paused ? (state.language === "en" ? "Resume group" : "Reprendre le groupe") : "paused", "pause-group", `data-paused="${d.group.paused ? "false" : "true"}"`, "secondary")}${button(state.language === "en" ? "Configure group" : "Configurer le groupe", "configure-group", "", "secondary")}${button(d.globalPaused ? (state.language === "en" ? "Resume all" : "Reprendre toutes les publications") : state.language === "en" ? "Pause all" : "Pause générale", "global-pause", `data-paused="${!d.globalPaused}"`, "secondary")}${link("source", "source")}${link("document", "document")}${link("digest", "digest")}</div><section class="admin-section"><h2>${state.language === "en" ? "Publication queue" : "File des publications"}</h2><div class="table-wrap"><table class="table"><thead><tr><th>Type</th><th>${t("status")}</th><th>Mode</th><th>${t("dueAt")}</th><th></th></tr></thead><tbody>${d.outbox.map((o) => `<tr><td>${esc(o.kind)}</td><td>${badge(o.status, o.status === "uncertain" ? "orange" : "")}</td><td>${t(o.mode)}</td><td>${when(o.due_at)}</td><td>${o.status === "uncertain" ? button(state.language === "en" ? "Reconcile" : "Réconcilier", "reconcile", `data-id="${o.id}"`, "secondary small") : ["pending", "failed"].includes(o.status) ? button("cancel", "cancel-job", `data-id="${o.id}"`, "secondary small") : ""}${o.error ? `<small>${esc(o.error)}</small>` : ""}</td></tr>`).join("") || `<tr><td colspan="5">${t("empty")}</td></tr>`}</tbody></table></div></section><section class="admin-section"><h2>${state.language === "en" ? "Editorial drafts" : "Brouillons éditoriaux"}</h2>${d.drafts.map((r) => `<div class="offer-box"><p>${esc(r.data.text)}</p>${button("publish", "approve-command", `data-id="${r.id}"`, "small")}</div>`).join("") || `<p>${t("empty")}</p>`}</section><section class="admin-section"><h2>${state.language === "en" ? "Members & permissions" : "Membres et droits"}</h2><div class="table-wrap"><table class="table"><tbody>${d.members.map((m) => `<tr><td>${esc(m.name)}</td><td>${t(m.role)}</td><td>${m.active ? t("active") : t("paused")}</td><td>${state.me.user.platformAdmin ? button(state.language === "en" ? "Manage" : "Gérer", "member-role", `data-id="${m.id}" data-role="${m.role}" data-active="${m.active}"`, "secondary small") : ""}</td></tr>`).join("")}</tbody></table></div>${state.me.user.platformAdmin ? button(state.language === "en" ? "Register a WhatsApp group" : "Enregistrer un groupe WhatsApp", "new-group", "", "secondary") : ""}</section><section class="admin-section"><h2>${state.language === "en" ? "Partners" : "Partenaires"}</h2>${d.partners.map((p) => `<div class="fact"><span>${esc(p.name)}</span>${button(p.active ? "paused" : "active", "partner", `data-id="${p.id}" data-active="${p.active ? "false" : "true"}"`, "secondary small")}</div>`).join("")}</section><section class="admin-section"><h2>${state.language === "en" ? "Capabilities · WAHA WEBJS" : "Capacités · WAHA WEBJS"}</h2><div class="table-wrap"><table class="table"><thead><tr><th>${state.language === "en" ? "Capability" : "Capacité"}</th><th>${state.language === "en" ? "Documented" : "Documentée"}</th><th>${state.language === "en" ? "Implemented" : "Implémentée"}</th></tr></thead><tbody>${Object.entries(
      d.capabilities,
    )
      .filter(([k, v]) => typeof v === "object")
      .map(
        ([k, v]) =>
          `<tr><td>${esc(k)}</td><td>${v.documented ? "✓" : "—"}</td><td>${v.implemented ? "✓" : "—"}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><p>${state.language === "en" ? "No live protocol validation yet. Poll closure, edits and hidden voters are not offered." : "Protocole réel non validé à ce stade. La clôture native, la modification des sondages et le masquage des votants ne sont pas proposés."}</p></section><section class="admin-section"><h2>${state.language === "en" ? "Reports & incidents" : "Signalements et incidents"}</h2>${d.reports.map((r) => `<div class="offer-box"><p>${esc(r.reason)}</p>${badge(r.status)}${r.status === "open" ? button(state.language === "en" ? "Resolve" : "Résoudre", "resolve-report", `data-id="${r.id}"`, "secondary small") : ""}</div>`).join("") || `<p>${t("empty")}</p>`}<div class="table-wrap"><table class="table"><tbody>${d.inbox
      .filter((e) => e.error)
      .map(
        (e) =>
          `<tr><td>${t(e.status)}</td><td>${esc(e.error)}</td><td>${when(e.created_at)}</td><td>${e.status === "failed" ? button(state.language === "en" ? "Retry" : "Reprendre", "retry-inbox", `data-id="${e.id}"`, "secondary small") : ""}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div></section><section class="admin-section"><h2>${state.language === "en" ? "Activity log" : "Journal d’activité"}</h2><div class="table-wrap"><table class="table"><tbody>${d.audit
      .slice(0, 20)
      .map((r) => `<tr><td>${esc(r.action)}</td><td>${when(r.at)}</td></tr>`)
      .join(
        "",
      )}</tbody></table></div><p>${state.language === "en" ? "Logs omit messages, passwords and phone numbers." : "Les journaux n’affichent ni conversations, ni mots de passe, ni numéros."}</p></section>`,
  );
  state.admin = d;
}
async function myPage() {
  const home = await api("/home"),
    prefs = state.me.user.preferences;
  const all = await Promise.all(
    ["request", "housing", "help", "story"].map((k) =>
      api("/records?kind=" + k),
    ),
  );
  const own = all.flat().filter((r) => r.owner_id === state.me.user.id);
  shell(
    `${heading(t("mine"), state.language === "en" ? "My registrations, contributions and choices." : "Mes inscriptions, mes contributions et mes choix.")}<section class="admin-section"><h2>${state.language === "en" ? "My registrations" : "Mes inscriptions"}</h2>${home.mine.map((e) => `<div class="fact"><a href="#detail/${e.record_id}">${esc(e.title)}</a>${badge(e.status)}</div>`).join("") || `<p>${t("empty")}</p>`}</section><div class="section-head"><h2>${state.language === "en" ? "My contributions" : "Mes contributions"}</h2></div><div class="cards">${own.map(card).join("") || empty("request")}</div><section class="admin-section"><h2>${state.language === "en" ? "My preferences & permissions" : "Mes préférences et autorisations"}</h2><form id="preferences-form"><div class="form-grid">${field("language", "select", prefs.language || "fr", { options: langs })}${field("zone", "text", prefs.zone || grp().zone)}${field("format", "select", prefs.format || "solo", { options: ["solo", "couple", "family"] })}${field("notifications", "checkbox", prefs.notifications, { wide: true })}${field("commercial", "checkbox", prefs.commercial, { label: state.language === "en" ? "I consent to private commercial notifications (separate permission)" : "J’accepte des notifications commerciales privées (accord distinct)", wide: true })}${field("visibility", "checkbox", prefs.visibility, { label: state.language === "en" ? "Allow my name on shared results" : "Autoriser mon nom sur les résultats partagés", wide: true })}</div><p class="form-error"></p><button class="btn" type="submit">${t("save")}</button></form></section><section class="admin-section"><h2>${state.language === "en" ? "My WhatsApp identity" : "Mon identité WhatsApp"}</h2><p>${state.language === "en" ? "A one-time code must be sent from your own WhatsApp account in the selected group. No phone number is inferred." : "Un code à usage unique doit être envoyé depuis votre propre compte WhatsApp dans le groupe choisi. Aucun numéro n’est déduit."}</p>${button(state.language === "en" ? "Generate a linking code" : "Générer un code de liaison", "link-identity", "", "secondary")}<div id="identity-result"></div></section><section class="admin-section"><h2>${state.language === "en" ? "My data" : "Mes données"}</h2><div class="actions">${button(state.language === "en" ? "Export my data" : "Exporter mes données", "download", 'data-path="/privacy/export" data-file="nanba-mes-donnees.json"', "secondary")}${button(state.language === "en" ? "Delete my account" : "Supprimer mon compte", "erase", "", "danger")}</div><p>${state.language === "en" ? "Copies already shared outside Nanba cannot be guaranteed deleted." : "Les copies déjà partagées hors de Nanba ne peuvent pas être garanties supprimées."}</p></section>`,
  );
  $("#preferences-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const p = await api("/preferences", formData(e.target));
      state.me.user.preferences = p;
      toast(t("saved"));
    } catch (err) {
      $("#preferences-form .form-error").textContent = errorText(err);
    }
  };
}
async function professionalPage() {
  const [requests, housing, offers] = await Promise.all(
    ["request", "housing", "offer"].map((k) => api("/records?kind=" + k)),
  );
  shell(
    `${heading(t("pro"), state.language === "en" ? "Prepare confirmed offers and respond to searches shared with your organization." : "Préparez des offres confirmées et répondez aux recherches partagées avec votre organisation.")}<div class="notice green">${state.language === "en" ? "You only see housing requests whose authors authorized your organization." : "Vous ne voyez que les recherches logement dont les auteurs ont autorisé votre organisation."}</div><div class="section-head"><h2>${t("housing")}</h2></div><div class="cards">${housing.map(card).join("") || empty("housing")}</div><div class="section-head"><h2>${t("request")}</h2></div><div class="cards">${requests.map(card).join("")}</div><div class="section-head"><h2>${t("offer")}</h2></div><div class="cards">${
      offers
        .filter((r) => r.owner_id === state.me.user.id)
        .map(card)
        .join("") || empty("offer")
    }</div>`,
  );
  progressWidths();
}
async function assistantPage() {
  shell(
    `${heading(t("assistant"), state.language === "en" ? "Understand an idea, find sources, prepare a draft. You stay in control." : "Clarifier une idée, retrouver des sources, préparer un texte. Vous gardez la main.")}<div class="notice">${t("languagesNote")}</div><div class="panel-form"><form id="agent-form">${field("text", "textarea", "", { label: state.language === "en" ? "What would you like to prepare?" : "Que souhaitez-vous préparer ?", max: 3000 })}${field("language", "select", state.language, { options: langs })}<p class="form-error"></p><button class="btn" type="submit">${state.language === "en" ? "Prepare a draft" : "Préparer un brouillon"}</button></form><div id="agent-result"></div></div><section class="admin-section"><h2>${state.language === "en" ? "Search verified knowledge" : "Rechercher dans les connaissances vérifiées"}</h2><form id="knowledge-form"><div class="toolbar"><input name="query" aria-label="${t("search")}" placeholder="${t("search")}"><button class="btn">${state.language === "en" ? "Search" : "Rechercher"}</button></div></form><div id="knowledge-results"></div></section>`,
  );
  $("#agent-form").onsubmit = async (e) => {
    e.preventDefault();
    e.submitter.disabled = true;
    try {
      const result = await api("/agent", formData(e.target));
      $("#agent-result").innerHTML =
        `<div class="notice">${result.message ? esc(result.message) : state.language === "en" ? "AI draft · review before use. No action has been executed." : "Brouillon IA · à relire. Aucune action n’a été exécutée."}</div>${result.draft ? `<pre>${esc(result.draft)}</pre>` : ""}<div class="actions">${link("propose", "new/request")}${link("radar", "new/radar")}${link("story", "new/story")}</div>`;
    } catch (err) {
      $("#agent-form .form-error").textContent = errorText(err);
    } finally {
      e.submitter.disabled = false;
    }
  };
  $("#knowledge-form").onsubmit = async (e) => {
    e.preventDefault();
    const docs = await api(
      "/knowledge?q=" + encodeURIComponent(new FormData(e.target).get("query")),
    );
    $("#knowledge-results").innerHTML =
      docs
        .map(
          (d) =>
            `<div class="offer-box"><a class="link-source" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a><p>${esc(d.excerpt)}</p><small>${esc(d.publisher)} · ${t("publishedAt")} : ${when(d.publishedAt)} · ${t("verifiedAt")} : ${when(d.verifiedAt)}</small></div>`,
        )
        .join("") || `<p>${t("empty")}</p>`;
  };
}
async function route() {
  if (location.hash.startsWith("#whatsapp-start")) return pairingPage();
  if (!state.me)
    return state.config.setup && location.hash.startsWith("#setup")
      ? renderSetup()
      : renderLogin();
  const [page = "home", id, parent] = (location.hash.slice(1) || "home").split(
    "/",
  );
  state.route = page === "detail" ? "" : page === "new" ? id : page;
  try {
    if (page === "home") await home();
    else if (page === "new") await createForm(id, parent);
    else if (page === "detail") await detail(id);
    else if (page === "admin") await adminPage();
    else if (page === "whatsapp") await whatsappPage();
    else if (page === "mine") await myPage();
    else if (page === "pro") await professionalPage();
    else if (page === "assistant") await assistantPage();
    else if (
      [
        "request",
        "meetup",
        "housing",
        "help",
        "volunteer",
        "radar",
        "cohort",
        "challenge",
        "story",
        "source",
        "document",
        "digest",
        "offer",
        "housing_offer",
      ].includes(page)
    )
      await listing(page);
    else location.hash = "home";
  } catch (e) {
    if (state.me)
      shell(
        `${heading(state.language === "en" ? "This page is unavailable" : "Cette page n’est pas disponible", "")}<div class="notice">${esc(errorText(e))}</div>${link("home", "home")}`,
      );
  }
}
async function login(email, password) {
  await api("/login", { email, password });
  state.me = await api("/me");
  state.csrf = state.me.csrf;
  if (!state.me.groups.some((g) => g.id === state.group))
    state.group = state.me.groups[0]?.id || "";
  localStorage.setItem("nanba-group", state.group);
  location.hash = "home";
  await route();
}
function renderLogin() {
  const demo = state.config.demo;
  $("#app").innerHTML =
    `<div class="login"><section class="login-intro"><div class="brand"><strong>nanba</strong><span>ENSEMBLE</span></div><h1>${t("heroTitle")}</h1><p>${t("promise")}</p></section><section class="login-form"><div><div class="eyebrow">${state.language === "en" ? "WELCOME TO YOUR COMMUNITY" : "BIENVENUE DANS VOTRE COMMUNAUTÉ"}</div><h2>${t("loginTitle")}</h2><p>${t("loginSub")}</p><form id="login-form">${field("email", "email")}${field("password", "password")}<p class="form-error" role="alert"></p><button type="submit" class="btn">${t("login")}</button></form>${
      demo
        ? `<div class="notice login-notice">${t("demoNote")}</div><p>${t("demoProfiles")}</p><div class="demo-options">${[
            ["member", "member"],
            ["organizer", "organizer"],
            ["pro", "professional"],
            ["admin", "group_admin"],
          ]
            .map(([id, label]) =>
              button(label, "demo-login", `data-profile="${id}"`),
            )
            .join("")}</div>`
        : ""
    }${state.config.setup ? `<p><a class="btn secondary" href="#setup">Activer mon accès administrateur</a></p>` : ""}<div class="footer-note">FR / EN · ${demo ? t("noFake") : "Accès privé au pilote"}</div></div></section></div>`;
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(e.target);
    try {
      await login(d.email, d.password);
    } catch (err) {
      $("#login-form .form-error").textContent = errorText(err);
    }
  };
}
function renderSetup() {
  const parts = location.hash.split("/");
  if (parts[1]) {
    state.setupKey = parts[1];
    history.replaceState(null, "", "#setup");
  }
  $("#app").innerHTML =
    `<div class="login"><section class="login-intro"><div class="brand"><strong>nanba</strong><span>ENSEMBLE</span></div><h1>Bienvenue dans votre pilote.</h1><p>Créez votre accès privé, puis associez WhatsApp.</p></section><section class="login-form"><div><h2>Activer mon accès</h2><form id="setup-form"><label>Clé d’activation<input name="key" type="password" autocomplete="off" required value="${esc(state.setupKey || "")}"></label><label>Votre prénom<input name="name" required autocomplete="given-name"></label><label>E-mail<input name="email" type="email" required autocomplete="email"></label><label>Mot de passe · 14 caractères minimum<input name="password" type="password" minlength="14" required autocomplete="new-password"></label><p class="form-error" role="alert"></p><button class="btn" type="submit">Créer mon accès privé</button></form><p>La clé ne fonctionne qu’une fois. Aucun compte de démonstration n’est accessible ici.</p></div></section></div>`;
  $("#setup-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = Object.fromEntries(new FormData(e.target));
    const submit = e.target.querySelector("button");
    submit.disabled = true;
    try {
      await api("/setup", input);
      state.setupKey = "";
      state.config.setup = false;
      await login(input.email, input.password);
      location.hash = "whatsapp";
    } catch (error) {
      $("#setup-form .form-error").textContent = errorText(error);
      submit.disabled = false;
    }
  };
}
let pairingTimer;
async function pairingPage() {
  clearTimeout(pairingTimer);
  const parts = location.hash.slice(1).split("/");
  if (parts[1]) {
    state.pairKey = parts[1];
    history.replaceState(null, "", "#whatsapp-start");
  }
  const wrap = (content) =>
    ($("#app").innerHTML =
      `<div class="login"><section class="login-intro"><div class="brand"><strong>nanba</strong><span>ENSEMBLE</span></div><h1>Ton assistant, dans WhatsApp.</h1><p>Un QR à scanner. Ensuite, teste directement dans ta discussion avec toi-même.</p></section><section class="login-form"><div>${content}</div></section></div>`);
  if (!state.pairKey) {
    wrap(
      `<h2>Connecter mon WhatsApp</h2><form id="pairing-key-form"><label>Clé privée du pilote<input name="key" type="password" autocomplete="off" required></label><button class="btn">Continuer</button></form><p>Ouvre le lien privé reçu pour éviter cette étape. Aucun compte web n’est nécessaire pour le test personnel.</p>`,
    );
    $("#pairing-key-form").onsubmit = (e) => {
      e.preventDefault();
      state.pairKey = new FormData(e.target).get("key");
      void pairingPage();
    };
    return;
  }
  const call = async (action, body) => {
    const response = await fetch("/api/pairing/" + action, {
      method: body ? "POST" : "GET",
      headers: {
        "X-Nanba-Setup-Key": state.pairKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Connexion indisponible");
    return result;
  };
  try {
    const d = await call("status");
    if (d.personalTestReady) {
      wrap(
        `<h2>C’est prêt dans WhatsApp</h2><p>Ouvre WhatsApp → nouvelle discussion → ton propre nom (« Vous »), puis envoie :</p><p><strong>Nanba aide</strong></p><p>Choisis ensuite un module avec <strong>Nanba rencontres</strong>, <strong>Nanba logement</strong>, <strong>Nanba entraide</strong>, <strong>Nanba radar</strong>, <strong>Nanba arrivée</strong>, <strong>Nanba défis</strong> ou <strong>Nanba histoires</strong>. Les formulaires, inscriptions et confirmations se font dans la conversation.</p><p>Le test personnel reste dans cette discussion. Pour autoriser ensuite un groupe, envoie toi-même <strong>Nanba activer groupe NOM</strong> dans ce groupe. Les membres pourront écrire <strong>Nanba rejoindre</strong> puis poursuivre leurs démarches en privé.</p><p class="footer-note">Pilote guidé · les réponses libres par IA externe restent à connecter.</p>`,
      );
      return;
    }
    if (d.connected) {
      wrap(
        `<h2>WhatsApp est connecté</h2><p>Active l’assistant uniquement dans ta discussion avec toi-même pour tester sans écrire à d’autres personnes.</p><button id="enable-self-test" class="btn">Activer mon test personnel</button><p id="pairing-error" role="alert"></p>`,
      );
      $("#enable-self-test").onclick = async () => {
        try {
          await call("self-test", { authorized: true });
          await pairingPage();
        } catch (e) {
          $("#pairing-error").textContent = e.message;
        }
      };
      return;
    }
    if (d.status === "SCAN_QR_CODE") {
      const qr = await call("qr");
      wrap(
        `<h2>Scanne ce QR avec WhatsApp</h2><img class="whatsapp-qr" src="${esc(qr.image)}" alt="QR privé de connexion WhatsApp"><p>Sur ton téléphone : <strong>WhatsApp → Réglages → Appareils connectés → Connecter un appareil</strong>.</p><p>Après association, cette page proposera d’activer ton test personnel.</p>`,
      );
      pairingTimer = setTimeout(() => {
        if (location.hash === "#whatsapp-start") void pairingPage();
      }, 6000);
      return;
    }
    if (d.status === "STARTING") {
      wrap(
        `<h2>Préparation du QR…</h2><p>Le connecteur démarre. Le QR apparaîtra automatiquement ici.</p>`,
      );
      pairingTimer = setTimeout(() => {
        if (location.hash === "#whatsapp-start") void pairingPage();
      }, 4000);
      return;
    }
    wrap(
      `<h2>Connecter WhatsApp</h2><p>Associe ton téléphone pour utiliser l’assistant directement dans WhatsApp. Le premier test se fera dans ta discussion personnelle.</p><button id="start-whatsapp-pairing" class="btn">Afficher mon QR WhatsApp</button><p id="pairing-error" role="alert"></p>`,
    );
    $("#start-whatsapp-pairing").onclick = async () => {
      try {
        $("#start-whatsapp-pairing").disabled = true;
        await call("connect", {});
        await pairingPage();
      } catch (e) {
        $("#pairing-error").textContent = e.message;
        $("#start-whatsapp-pairing").disabled = false;
      }
    };
  } catch (e) {
    wrap(
      `<h2>Connexion WhatsApp</h2><p role="alert">${esc(e.message)}</p><p>Rouvre ton lien privé. Si ton compte administrateur est déjà créé, utilise Connexion WhatsApp depuis ce compte.</p><a class="btn secondary" href="#home">Connexion administrateur</a>`,
    );
  }
}
async function whatsappPage() {
  const d = await api("/whatsapp/status");
  const connected = d.connected;
  shell(
    `${heading("Connexion WhatsApp", "Associez le compte du bot, puis autorisez uniquement votre groupe de test.")}<div class="notice">État : <strong>${esc(d.status)}</strong> · WAHA WEBJS. L’IA n’est pas encore connectée.</div><section class="detail-card"><h2>1. Associer le compte WhatsApp</h2><p>Sur le téléphone du bot : WhatsApp → Réglages → Appareils connectés → Connecter un appareil.</p><div class="toolbar">${!connected ? `<button type="button" class="btn" id="wa-connect">Afficher le QR code</button>` : ""}<button type="button" class="btn secondary" id="wa-refresh">Actualiser l’état</button></div><p id="wa-message" role="status"></p><div id="wa-qr"></div></section>${connected ? `<section class="detail-card"><h2>2. Choisir le groupe de test</h2><p>Créez un groupe WhatsApp privé avec le compte du bot et votre compte de test, puis actualisez cette page.</p><form id="wa-group"><label>Groupe WhatsApp<select name="chatId" id="wa-groups" required><option value="">Choisir un groupe</option></select></label><label><input type="checkbox" name="authorized" required> Je confirme que ce groupe est réservé aux essais et que ses membres acceptent les messages du bot.</label><button class="btn" type="submit">Autoriser ce groupe</button><p id="wa-group-result" role="status"></p></form></section><section class="detail-card"><h2>3. Tester le sondage</h2><p>Ce bouton envoie un vrai sondage au groupe autorisé. Votez depuis un autre compte que celui du bot, puis consultez le résultat dans Nanba.</p><button class="btn" type="button" id="wa-poll">Envoyer un sondage de test</button><p id="wa-poll-result" role="status"></p><p>Les commandes /aide et les mentions préparent une réponse automatique guidée dans ce groupe autorisé. Pour créer une demande : « Nanba proposer une sortie ».</p></section>` : ""}`,
  );
  $("#wa-refresh").onclick = () =>
    void whatsappPage().catch((e) => toast(errorText(e)));
  if ($("#wa-connect"))
    $("#wa-connect").onclick = async () => {
      try {
        $("#wa-connect").disabled = true;
        await api("/whatsapp/connect", {});
        await whatsappPage();
      } catch (e) {
        toast(errorText(e));
        if ($("#wa-connect")) $("#wa-connect").disabled = false;
      }
    };
  if (d.status === "SCAN_QR_CODE") {
    try {
      const qr = await api("/whatsapp/qr");
      $("#wa-qr").innerHTML =
        `<img class="whatsapp-qr" src="${esc(qr.image)}" alt="QR code pour associer votre compte WhatsApp"><p>Scannez ce QR code, puis cliquez sur Actualiser l’état.</p>`;
    } catch (e) {
      $("#wa-message").textContent = errorText(e);
    }
  }
  if (d.status === "STARTING") {
    $("#wa-message").textContent =
      "WhatsApp démarre. Le QR code apparaîtra dans quelques instants.";
    setTimeout(() => {
      if (location.hash === "#whatsapp")
        void whatsappPage().catch((e) => toast(errorText(e)));
    }, 4000);
  }
  if (connected) {
    const groups = await api("/whatsapp/groups");
    $("#wa-groups").innerHTML += groups
      .map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`)
      .join("");
    $("#wa-group").onsubmit = async (e) => {
      e.preventDefault();
      try {
        const form = new FormData(e.target);
        const result = await api("/whatsapp/bind", {
          chatId: form.get("chatId"),
          authorized: form.get("authorized") === "on",
        });
        $("#wa-group-result").textContent = "Groupe autorisé : " + result.name;
        state.me = await api("/me");
      } catch (error) {
        $("#wa-group-result").textContent = errorText(error);
      }
    };
    $("#wa-poll").onclick = async () => {
      const b = $("#wa-poll");
      b.disabled = true;
      try {
        const result = await api("/whatsapp/poll", {});
        $("#wa-poll-result").innerHTML =
          `Sondage mis en attente d’envoi. <a href="#detail/${esc(result.requestId)}">Consulter les votes</a>`;
      } catch (e) {
        $("#wa-poll-result").textContent = errorText(e);
      } finally {
        b.disabled = false;
      }
    };
  }
}
async function recordAction(action, b = {}) {
  return api("/records/" + state.record.id + "/action", { action, ...b });
}
async function download(path, name) {
  const res = await fetch("/api" + path, {
    credentials: "same-origin",
    headers: { "X-Group-Id": state.group },
  });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.error);
  }
  const blob = await res.blob(),
    href = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  const r = state.record,
    d = r?.data;
  try {
    if (action === "menu") {
      $(".sidebar")?.classList.toggle("open");
      $(".mobile-scrim")?.classList.toggle("visible");
      return;
    }
    if (action === "close") {
      $("#modal").close();
      return;
    }
    if (action === "demo-login") {
      target.disabled = true;
      await login(target.dataset.profile + "@demo.nanba", "Nanba-demo-2026!");
      return;
    }
    if (action === "logout") {
      await api("/logout", {});
      state.me = null;
      state.csrf = "";
      renderLogin();
      return;
    }
    if (action === "download") {
      await download(target.dataset.path, target.dataset.file);
      return;
    }
    if (action === "record-action") {
      target.disabled = true;
      await recordAction(target.dataset.name, JSON.parse(target.dataset.body));
      await route();
      toast(t("success"));
      return;
    }
    if (action === "enroll") {
      dialog(
        t("join"),
        field("seats", "number", d.enrollment?.seats || 1, { min: 1, max: 6 }) +
          field("accept", "checkbox", false, {
            required: true,
            wide: true,
            label: t("acceptTerms"),
          }),
        (b) => recordAction("enroll", { ...b, version: r.version }),
        "join",
        (d.terms ? d.terms + " · " : "") +
          "Version " +
          r.version +
          " · " +
          t("waitNote"),
      );
      return;
    }
    if (action === "simulate") {
      dialog(
        state.language === "en"
          ? "Simulated WhatsApp vote"
          : "Vote WhatsApp simulé",
        field("voter", "text", "33600000001@c.us", {
          label:
            state.language === "en"
              ? "Synthetic WhatsApp ID"
              : "Identité WhatsApp fictive",
        }) +
          field("choice", "select", "yes", {
            label: t("interest"),
            options: [
              ["yes", t("interest")],
              [
                "no",
                state.language === "en" ? "Not this time" : "Pas cette fois",
              ],
              ["withdraw", t("withdrawInterest")],
            ],
          }),
        async (b) => {
          await api("/admin/simulate-vote", {
            pollId: d.poll.id,
            voter: b.voter,
            choices: b.choice === "withdraw" ? [] : [b.choice],
          });
          await api("/admin/process", {});
        },
        "save",
        t("simulation"),
      );
      return;
    }
    if (action === "revise-offer") {
      dialog(
        state.language === "en" ? "Revise the offer" : "Modifier l’offre",
        field("price", "number", d.price / 100, { step: 0.01 }) +
          field("startsAt", "datetime-local", localDate(d.startsAt)) +
          field("terms", "textarea", d.terms),
        (b) =>
          recordAction("revise", { ...b, price: Math.round(b.price * 100) }),
      );
      return;
    }
    if (action === "consent") {
      const orgs = await api("/organizations");
      dialog(
        t("sharedWith"),
        orgs
          .map((o) =>
            field("org_" + o.id, "checkbox", d.sharedWith.includes(o.id), {
              label: o.name,
              wide: true,
            }),
          )
          .join(""),
        (b) =>
          recordAction("consent", {
            sharedWith: orgs.filter((o) => b["org_" + o.id]).map((o) => o.id),
          }),
      );
      return;
    }
    if (action === "dispute") {
      dialog(t("report"), field("reason", "textarea"), (b) =>
        recordAction("dispute", b),
      );
      return;
    }
    if (action === "confirm-radar") {
      dialog(
        state.language === "en"
          ? "Confirm information"
          : "Confirmer l’information",
        field("confirmation", "select", "organizer", {
          label:
            state.language === "en"
              ? "Confirmation obtained from"
              : "Confirmation obtenue auprès de",
          options: [
            [
              "organizer",
              state.language === "en"
                ? "Organizer / shop"
                : "Organisateur / commerçant",
            ],
            [
              "official",
              state.language === "en" ? "Official source" : "Source officielle",
            ],
          ],
        }) +
          field("evidence", "url", "", { label: t("evidence") }) +
          field("hours", "number", 48, {
            label:
              state.language === "en"
                ? "Valid for (hours)"
                : "Validité (heures)",
            min: 1,
            max: 720,
          }),
        (b) => recordAction("confirm", b),
      );
      return;
    }
    if (action === "correct-radar") {
      dialog(
        state.language === "en"
          ? "Correct information"
          : "Corriger l’information",
        field("description", "textarea", d.description),
        (b) => recordAction("correct", b),
      );
      return;
    }
    if (action === "join-challenge") {
      dialog(
        t("join"),
        field("team", "select", d.teams[0], {
          label: state.language === "en" ? "My team" : "Mon équipe",
          options: d.teams,
        }) +
          field("visible", "checkbox", false, {
            label:
              state.language === "en"
                ? "Allow my name on shared results"
                : "Autoriser mon nom sur les résultats partagés",
            wide: true,
          }),
        (b) => recordAction("join", b),
      );
      return;
    }
    if (action === "correct-challenge") {
      dialog(
        state.language === "en"
          ? "Correct the answer key"
          : "Corriger le barème",
        field("question", "number", 1, { min: 1, max: d.questions.length }) +
          field("answer", "number", 1, { min: 1, max: 10 }) +
          field("reason", "textarea"),
        (b) =>
          recordAction("correct", {
            ...b,
            question: b.question - 1,
            answer: b.answer - 1,
          }),
      );
      return;
    }
    if (action === "edit-story") {
      dialog(
        state.language === "en" ? "Edit the story" : "Modifier le récit",
        field("title", "text", d.title) +
          field("original", "textarea", d.original, { max: 1500 }) +
          field("translation", "textarea", d.translation, {
            max: 1500,
            required: false,
          }),
        (b) => recordAction("edit", b),
      );
      return;
    }
    if (action === "approve-story") {
      dialog(
        state.language === "en" ? "Author approval" : "Validation de l’auteur",
        field("rightsConfirmed", "checkbox", false, {
          required: true,
          label:
            state.language === "en"
              ? "I am the author and authorize use of this content."
              : "Je suis l’auteur et j’autorise l’utilisation de ce contenu.",
          wide: true,
        }) +
          field("translationReviewed", "checkbox", false, {
            required: true,
            label:
              state.language === "en"
                ? "I reviewed the original and translated versions."
                : "J’ai relu la version originale et la traduction.",
            wide: true,
          }) +
          field("whatsapp", "checkbox", false, {
            label:
              state.language === "en"
                ? "I also authorize sharing in this WhatsApp group."
                : "J’autorise aussi le partage dans ce groupe WhatsApp.",
            wide: true,
          }) +
          (d.storyType === "verified_history"
            ? field("source", "url", "", { label: t("sourceUrl") })
            : ""),
        (b) =>
          recordAction("approve", {
            ...b,
            audiences: b.whatsapp ? ["nanba", "whatsapp"] : ["nanba"],
          }),
        "save",
        state.language === "en"
          ? "Publication is limited to Nanba and the selected WhatsApp group. It does not authorize TikTok."
          : "Publication limitée à Nanba et, si choisi, au groupe WhatsApp. Cela n’autorise pas TikTok.",
      );
      return;
    }
    if (action === "feedback") {
      dialog(
        state.language === "en" ? "Feedback" : "Mon retour",
        field("rating", "number", 5, {
          label: state.language === "en" ? "Rating / 5" : "Note / 5",
          min: 1,
          max: 5,
        }) +
          field("comment", "textarea", "", {
            required: false,
            label:
              state.language === "en"
                ? "Optional comment"
                : "Commentaire facultatif",
          }),
        (b) => recordAction("feedback", b),
      );
      return;
    }
    if (action === "payment") {
      await api("/payment/checkout", { enrollmentId: d.enrollment.id });
      return;
    }
    if (action === "process") {
      await api("/admin/process", {});
      await route();
      toast(t("success"));
      return;
    }
    if (action === "collect") {
      target.disabled = true;
      await api("/admin/collect", { id: r.id });
      await route();
      return;
    }
    if (action === "pause-group" || action === "global-pause") {
      await api("/admin/action", {
        action: action === "pause-group" ? "group" : "global_pause",
        paused: target.dataset.paused === "true",
      });
      await route();
      return;
    }
    if (action === "configure-group") {
      const g = state.admin.group;
      dialog(
        state.language === "en" ? "Configure group" : "Configurer le groupe",
        field("name", "text", g.name, {
          label: state.language === "en" ? "Group name" : "Nom du groupe",
        }) +
          field("chatId", "text", g.chat_id, { label: "WhatsApp group ID" }) +
          field("allowed", "checkbox", g.allowed, {
            label:
              state.language === "en"
                ? "Authorize publications to this group"
                : "Autoriser les publications dans ce groupe",
            wide: true,
          }),
        (b) => api("/admin/action", { action: "group", ...b }),
      );
      return;
    }
    if (action === "new-group") {
      dialog(
        state.language === "en" ? "Register a group" : "Enregistrer un groupe",
        field("name", "text", "", {
          label: state.language === "en" ? "Group name" : "Nom du groupe",
        }) +
          field("zone") +
          field("chatId", "text", "", { label: "WhatsApp group ID" }),
        (b) => api("/admin/action", { action: "new_group", ...b }),
      );
      return;
    }
    if (action === "member-role") {
      dialog(
        state.language === "en" ? "Member permissions" : "Droits du membre",
        field("role", "select", target.dataset.role, {
          label: state.language === "en" ? "Role" : "Rôle",
          options: ["member", "organizer", "professional", "group_admin"],
        }) +
          field("active", "checkbox", target.dataset.active === "1", {
            label: t("active"),
          }),
        (b) =>
          api("/admin/action", {
            action: "member",
            userId: target.dataset.id,
            ...b,
          }),
      );
      return;
    }
    if (action === "partner") {
      await api("/admin/action", {
        action: "partner",
        orgId: target.dataset.id,
        active: target.dataset.active === "true",
      });
      await route();
      return;
    }
    if (["cancel-job", "approve-command", "resolve-report"].includes(action)) {
      await api("/admin/action", {
        action: {
          "cancel-job": "cancel_job",
          "approve-command": "approve_command",
          "resolve-report": "report_resolve",
        }[action],
        id: target.dataset.id,
      });
      await route();
      return;
    }
    if (action === "retry-inbox") {
      await api("/admin/retry-inbox", { id: target.dataset.id });
      await route();
      return;
    }
    if (action === "reconcile") {
      dialog(
        state.language === "en"
          ? "Reconcile with evidence"
          : "Réconcilier avec justificatif",
        field("providerId", "text", "", {
          label:
            state.language === "en"
              ? "Provider message ID"
              : "Identifiant du message fournisseur",
        }) +
          field("evidence", "textarea", "", {
            label:
              state.language === "en"
                ? "Evidence reviewed by administrator"
                : "Preuve examinée par l’administrateur",
          }),
        (b) =>
          api("/admin/action", {
            action: "reconcile",
            id: target.dataset.id,
            ...b,
          }),
        "save",
        state.language === "en"
          ? "Check the provider before proceeding. This action does not resend anything."
          : "Vérifiez chez le fournisseur avant de poursuivre. Cette action ne renvoie aucun message.",
      );
      return;
    }
    if (action === "link-identity") {
      const result = await api("/identity/link", {});
      $("#identity-result").innerHTML =
        `<pre>${esc(result.instruction)}</pre><p>${t("expiresAt")} : ${when(result.expiresAt)}</p>${state.me.mode === "simulated" ? `<div class="notice">${t("simulation")}</div>` : ""}`;
      return;
    }
    if (action === "erase") {
      dialog(
        state.language === "en" ? "Delete my account" : "Supprimer mon compte",
        field("password", "password"),
        async (b) => {
          await api("/privacy/delete", b);
          state.me = null;
          renderLogin();
        },
        "save",
        state.language === "en"
          ? "This removes your personal content and access. Shared external copies may remain."
          : "Cette action supprime vos contenus personnels et vos accès. Des copies déjà partagées à l’extérieur peuvent subsister.",
      );
      return;
    }
    if (action === "current-radar") {
      const current = state.items.filter(
        (r) => r.status === "published" && !r.data.expired,
      );
      $("#items").innerHTML = current.map(card).join("") || empty("radar");
      return;
    }
    if (action === "match") {
      dialog(
        state.language === "en" ? "Find a gathering" : "Trouver une rencontre",
        field("zone", "text", state.me.user.preferences.zone || grp().zone) +
          field("language", "select", state.language, { options: langs }) +
          field("activity", "select", "Café", {
            options: [
              "Café",
              "Balade",
              "Cinéma",
              "Déjeuner",
              "Sport",
              "Culture",
            ],
          }) +
          field("format", "select", "solo", {
            options: ["solo", "couple", "family"],
          }),
        async (b) => {
          const results = await api("/matches", b);
          state.matchResults = results;
          location.hash = "meetup";
          setTimeout(() => {
            $("#items").innerHTML =
              results
                .map(
                  (r) =>
                    card(r) +
                    `<small>${r.reasons.map((k) => t(k)).join(" · ")}</small>`,
                )
                .join("") || empty("meetup");
          }, 100);
        },
      );
      return;
    }
  } catch (err) {
    toast(errorText(err));
    target.disabled = false;
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "group-select") {
    state.group = e.target.value;
    localStorage.setItem("nanba-group", state.group);
    await route();
  }
  if (e.target.id === "language-select") {
    state.language = e.target.value.toLowerCase();
    localStorage.setItem("nanba-language", state.language);
    await route();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "filter") {
    const q = e.target.value.toLowerCase();
    $("#items").innerHTML =
      state.items
        .filter((r) =>
          (r.data.title + " " + (r.data.zone || "")).toLowerCase().includes(q),
        )
        .map(card)
        .join("") || empty(state.route);
    progressWidths();
  }
});
window.addEventListener("hashchange", () => void route());
async function boot() {
  try {
    state.config = await api("/config");
    try {
      state.me = await api("/me");
      state.csrf = state.me.csrf;
      if (!state.me.groups.some((g) => g.id === state.group))
        state.group = state.me.groups[0]?.id || "";
    } catch {}
    await route();
  } catch (e) {
    $("#app").innerHTML =
      `<div class="error-page"><h1>Nanba Ensemble</h1><p>${esc(errorText(e))}</p></div>`;
  }
}
void boot();
