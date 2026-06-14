import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

const departments = ['75', '92', '93', '94', '77', '78', '91', '95'];
const types = ['Studio', 'T1', 'T2', 'T3', 'T4', 'T5+'];
const languages = ['FR', 'தமிழ்', 'മലയാളം', 'हिन्दी', 'తెలుగు'];

const listings = [
  { id: '1', title: 'Studio meuble proche metro', city: 'Paris 13e', department: '75', type: 'Studio', rent: 820, surface: 22, broker: 'Maison Tamil France' },
  { id: '2', title: 'T2 lumineux pour jeune actif', city: 'Courbevoie', department: '92', type: 'T2', rent: 1180, surface: 42, broker: 'Bridge Immo' },
  { id: '3', title: 'Colocation calme pres campus', city: 'Creteil', department: '94', type: 'T3', rent: 690, surface: 68, broker: 'Sud Residence' },
];

const requests = [
  { name: 'Anjali', need: 'Studio ou T1', area: 'Paris, 92', budget: 900, timing: 'Avant septembre' },
  { name: 'Kavin', need: 'T2', area: '94, 77', budget: 1200, timing: 'Sous 30 jours' },
];

const news = [
  'Inde-France : les points a verifier pour les nouveaux etudiants',
  'Tech : startups IA, fintech et mobilite en forte croissance',
  'Logement : dossier, garant, assurance et premier loyer',
];

export default function App() {
  const [tab, setTab] = useState('client');
  const [language, setLanguage] = useState('FR');
  const [type, setType] = useState('Tous');
  const [department, setDepartment] = useState('Tous');
  const [maxRent, setMaxRent] = useState('1200');

  const filteredListings = useMemo(() => {
    const rent = Number(maxRent) || 99999;
    return listings.filter((item) => {
      return (type === 'Tous' || item.type === type)
        && (department === 'Tous' || item.department === department)
        && item.rent <= rent;
    });
  }, [department, maxRent, type]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.logo}>Nanba</Text>
          <Text style={styles.subtitle}>Logement, brokers et news pour la communaute indienne en France</Text>
        </View>
        <View style={styles.languageBadge}><Text style={styles.languageBadgeText}>{language}</Text></View>
      </View>

      <View style={styles.rail}>
        {languages.map((item) => (
          <Pressable key={item} onPress={() => setLanguage(item)} style={[styles.langChip, language === item && styles.langChipActive]}>
            <Text style={[styles.langText, language === item && styles.langTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabs}>
        {[
          ['client', 'Client'],
          ['housing', 'Logements'],
          ['broker', 'Broker'],
          ['news', 'News'],
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
              <Text style={styles.heroTitle}>Trouver un logement en France, sans parcours complique.</Text>
              <Text style={styles.heroText}>Le client depose une demande claire. Les brokers abonnes recoivent les demandes qui correspondent a leurs criteres.</Text>
              <Pressable style={styles.primaryButton} onPress={() => setTab('housing')}>
                <Text style={styles.primaryButtonText}>Chercher un logement</Text>
              </Pressable>
            </View>
            <RequestForm />
          </>
        )}

        {tab === 'housing' && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Filtres rapides</Text>
              <Text style={styles.label}>Type</Text>
              <View style={styles.wrap}>{['Tous', ...types].map((item) => <Chip key={item} label={item} active={type === item} onPress={() => setType(item)} />)}</View>
              <Text style={styles.label}>Departement</Text>
              <View style={styles.wrap}>{['Tous', ...departments].map((item) => <Chip key={item} label={item} active={department === item} onPress={() => setDepartment(item)} />)}</View>
              <Text style={styles.label}>Loyer maximum</Text>
              <TextInput value={maxRent} onChangeText={setMaxRent} keyboardType="number-pad" style={styles.input} />
            </View>
            {filteredListings.map((item) => <Listing key={item.id} item={item} />)}
          </>
        )}

        {tab === 'broker' && (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Espace broker</Text>
              <TextInput style={styles.input} placeholder="Nom de societe" placeholderTextColor="#8d8275" />
              <TextInput style={styles.input} placeholder="Contact professionnel" placeholderTextColor="#8d8275" />
              <TextInput style={styles.input} placeholder="Biens proposes a la location" placeholderTextColor="#8d8275" />
            </View>
            <View style={styles.pricingRow}>
              <Plan title="Gratuit" price="0 EUR" text="Demandes visibles, 5 clics coordonnees par jour, contact limite." />
              <Plan highlighted title="Pro" price="10 EUR/mois" text="Contacts illimites, visibilite, notifications ciblees." />
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Notifications Pro</Text>
              <Text style={styles.label}>Departements</Text>
              <View style={styles.wrap}>{departments.map((item) => <Text key={item} style={styles.tag}>{item}</Text>)}</View>
              <Text style={styles.label}>Types de logement</Text>
              <View style={styles.wrap}>{types.map((item) => <Text key={item} style={styles.tag}>{item}</Text>)}</View>
              <Text style={styles.label}>Loyer maximum possible pour le locataire</Text>
              <TextInput style={styles.input} value="1200 EUR" editable={false} />
            </View>
            {requests.map((item) => (
              <View key={item.name} style={styles.card}>
                <Text style={styles.cardTitle}>{item.name} cherche {item.need}</Text>
                <Text style={styles.cardMeta}>{item.area} · budget {item.budget} EUR · {item.timing}</Text>
                <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Voir les coordonnees</Text></Pressable>
              </View>
            ))}
          </>
        )}

        {tab === 'news' && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>News Inde, France et tech</Text>
            {news.map((item) => (
              <View key={item} style={styles.newsItem}>
                <Text style={styles.newsTitle}>{item}</Text>
                <Text style={styles.cardMeta}>Resume court, utile et traduit progressivement selon la langue choisie.</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestForm() {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Deposer ma demande</Text>
      <TextInput style={styles.input} placeholder="Ville ou departement souhaite" placeholderTextColor="#8d8275" />
      <TextInput style={styles.input} placeholder="Budget maximum" placeholderTextColor="#8d8275" keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Date d'entree souhaitee" placeholderTextColor="#8d8275" />
      <Pressable style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Envoyer ma demande</Text></Pressable>
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

function Listing({ item }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.price}>{item.rent} EUR</Text>
      </View>
      <Text style={styles.cardMeta}>{item.city} · {item.type} · {item.surface} m2</Text>
      <Text style={styles.cardMeta}>Broker : {item.broker}</Text>
    </View>
  );
}

function Plan({ highlighted, price, text, title }) {
  return (
    <View style={[styles.plan, highlighted && styles.planHighlighted]}>
      <Text style={[styles.planTitle, highlighted && styles.planTitleHighlighted]}>{title}</Text>
      <Text style={[styles.planPrice, highlighted && styles.planTitleHighlighted]}>{price}</Text>
      <Text style={[styles.planText, highlighted && styles.planTextHighlighted]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff8f0' },
  topBar: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 30, fontWeight: '900', color: '#16201b' },
  subtitle: { width: 260, marginTop: 2, color: '#6d6257', fontSize: 12, lineHeight: 16 },
  languageBadge: { backgroundColor: '#16201b', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18 },
  languageBadgeText: { color: '#ffffff', fontWeight: '800' },
  rail: { paddingHorizontal: 18, flexDirection: 'row', gap: 8, marginBottom: 12 },
  langChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#eadfd2' },
  langChipActive: { backgroundColor: '#e84d35', borderColor: '#e84d35' },
  langText: { color: '#4e443b', fontWeight: '700' },
  langTextActive: { color: '#ffffff' },
  tabs: { marginHorizontal: 18, padding: 4, borderRadius: 20, backgroundColor: '#f0e4d6', flexDirection: 'row', gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 16, alignItems: 'center' },
  tabActive: { backgroundColor: '#ffffff' },
  tabText: { color: '#6d6257', fontWeight: '800', fontSize: 12 },
  tabTextActive: { color: '#16201b' },
  content: { padding: 18, paddingBottom: 34, gap: 14 },
  hero: { backgroundColor: '#16201b', borderRadius: 26, padding: 22, minHeight: 230, justifyContent: 'space-between' },
  heroTitle: { color: '#ffffff', fontSize: 27, lineHeight: 33, fontWeight: '900' },
  heroText: { color: '#c9d8cd', lineHeight: 21, marginTop: 12 },
  primaryButton: { marginTop: 22, backgroundColor: '#f7c84b', borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#16201b', fontWeight: '900' },
  panel: { backgroundColor: '#ffffff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#eadfd2', gap: 10 },
  panelTitle: { fontSize: 20, fontWeight: '900', color: '#16201b' },
  input: { backgroundColor: '#fff8f0', borderWidth: 1, borderColor: '#eadfd2', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, color: '#16201b' },
  secondaryButton: { marginTop: 4, backgroundColor: '#e84d35', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#ffffff', fontWeight: '900' },
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
  pricingRow: { flexDirection: 'row', gap: 10 },
  plan: { flex: 1, backgroundColor: '#ffffff', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: '#eadfd2', gap: 8 },
  planHighlighted: { backgroundColor: '#16201b', borderColor: '#16201b' },
  planTitle: { color: '#16201b', fontSize: 18, fontWeight: '900' },
  planTitleHighlighted: { color: '#ffffff' },
  planPrice: { color: '#e84d35', fontWeight: '900' },
  planText: { color: '#6d6257', lineHeight: 18, fontSize: 12 },
  planTextHighlighted: { color: '#c9d8cd' },
  newsItem: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eadfd2', gap: 6 },
  newsTitle: { color: '#16201b', fontWeight: '900', fontSize: 16, lineHeight: 21 },
});
