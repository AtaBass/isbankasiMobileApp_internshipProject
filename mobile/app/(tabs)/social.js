import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { social as api } from '../../lib/api';

function formatMoney(n) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n);
}

// Kimin kime ne kadar borcu olduğunu hesapla (katkılar eşit bölünür)
function computeDebts(contributions) {
  const total = contributions.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const n = contributions.length;
  if (n === 0) return [];
  const avg = total / n;
  const balances = contributions.map((c) => ({ name: c.name, balance: (Number(c.amount) || 0) - avg }));
  const debtors = balances.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
  const creditors = balances.filter((b) => b.balance > 0.01).sort((a, b) => b.balance - a.balance);
  const debts = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(-d.balance, c.balance);
    if (amount >= 0.01) {
      debts.push({ from: d.name, to: c.name, amount: Math.round(amount * 100) / 100 });
      debtors[i].balance += amount;
      creditors[j].balance -= amount;
    }
    if (debtors[i].balance >= -0.01) i++;
    if (creditors[j].balance <= 0.01) j++;
  }
  return debts;
}

// Borç listesini 3. görseldeki gibi kartlara çevir (X sana borçlu / Sen Y'ye borçlusun)
function debtsToCards(debts, currentUser) {
  const cards = [];
  debts.forEach((d) => {
    if (d.to === currentUser) cards.push({ type: 'owes_me', who: d.from, amount: d.amount, reason: 'Split' });
    if (d.from === currentUser) cards.push({ type: 'i_owe', who: d.to, amount: d.amount, reason: 'Split' });
  });
  return cards;
}

// Kumbara simgeleri (hedeflerdeki gibi rastgele atanır)
const JAR_ICONS = [
  { icon: 'airplane', bg: '#dbeafe', color: '#2563eb' },
  { icon: 'restaurant', bg: '#dcfce7', color: '#16a34a' },
  { icon: 'wallet', bg: '#f3e8ff', color: '#7c3aed' },
  { icon: 'gift', bg: '#ffedd5', color: '#ea580c' },
  { icon: 'cafe', bg: '#fef3c7', color: '#d97706' },
  { icon: 'film', bg: '#e0e7ff', color: '#4f46e5' },
];
function getRandomJarIcon() {
  return JAR_ICONS[Math.floor(Math.random() * JAR_ICONS.length)];
}

// Örnek kumbaralar: contributions = kim ne kadar para ekledi
const SAMPLE_JARS = [
  {
    id: '1',
    name: 'Yaz Tatili 2024',
    tag: 'TATİL',
    tagStyle: 'travel',
    icon: 'airplane',
    savings: 1200,
    memberCount: 4,
    members: ['Ayşe', 'Bora', 'Can', 'Deniz'],
    targetAmount: 5000,
    contributions: [
      { name: 'Ayşe', amount: 400 },
      { name: 'Bora', amount: 350 },
      { name: 'Can', amount: 250 },
      { name: 'Deniz', amount: 200 },
    ],
  },
  {
    id: '2',
    name: 'Yemek Kumbarası',
    tag: 'SOSYAL',
    tagStyle: 'social',
    icon: 'restaurant',
    savings: 450,
    memberCount: 6,
    members: ['Elif', 'Fatma', 'Gül', 'Hakan', 'İrem', 'Kemal'],
    targetAmount: 1500,
    contributions: [
      { name: 'Elif', amount: 100 },
      { name: 'Fatma', amount: 80 },
      { name: 'Gül', amount: 90 },
      { name: 'Hakan', amount: 60 },
      { name: 'İrem', amount: 70 },
      { name: 'Kemal', amount: 50 },
    ],
  },
];

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [debts, setDebts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAllJars, setShowAllJars] = useState(false);
  const [showJoinJar, setShowJoinJar] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinIban, setJoinIban] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendIban, setNewFriendIban] = useState('');
  const [friendRequests, setFriendRequests] = useState([
    { id: 'fr-1', name: 'Mehmet A.', iban: 'TR00 0000 0000 0000 0000 0000 00' },
  ]);
  const [groupName, setGroupName] = useState('');
  const [groupTarget, setGroupTarget] = useState('');
  const [inviteCode, setInviteCode] = useState(''); // IBAN (UI tarafında)
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [inviteHubVisible, setInviteHubVisible] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [activeSuggestCategory, setActiveSuggestCategory] = useState(1); // Restoran default
  const [selectedJar, setSelectedJar] = useState(null);
  const [splitSource, setSplitSource] = useState(null);
  const [selectedJarForSplit, setSelectedJarForSplit] = useState(null);
  const [splitEntries, setSplitEntries] = useState([]);
  const [newSplitPerson, setNewSplitPerson] = useState('');
  const [newSplitAmount, setNewSplitAmount] = useState('');
  const [newSplitDebts, setNewSplitDebts] = useState(null);
  const [showPersonPicker, setShowPersonPicker] = useState(false);

  const load = async () => {
    try {
      const [g] = await Promise.all([
        api.groups().catch(() => []),
      ]);
      setGroups((g || []).map((gr) => ({ ...gr, icon: gr.icon || getRandomJarIcon().icon }))); 
      if (g.length > 0) {
        const d = await api.debts(g[0].id).catch(() => ({ debts: [] }));
        setDebts(d.debts || []);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      await api.createGroup({
        name: groupName.trim(),
        type: 'piggy_bank',
        target: groupTarget.trim() || undefined,
        icon: getRandomJarIcon().icon,
      });
      const nowId = String(Date.now());
      const createdJar = {
        id: nowId,
        name: groupName.trim(),
        tag: 'SOSYAL',
        tagStyle: 'social',
        icon: getRandomJarIcon().icon,
        savings: 0,
        memberCount: 1,
        members: ['Sen'],
        targetAmount: groupTarget ? Number(groupTarget.replace(',', '.')) || 0 : 0,
        contributions: [{ name: 'Sen', amount: 0 }],
        iban: inviteCode.trim() || null,
        inviteCodes: [
          `IGS-${nowId.slice(-4)}`,
          `IGS-${nowId.slice(-4)}-A`,
          `IGS-${nowId.slice(-4)}-B`,
        ],
      };
      setUserJars((prev) => [createdJar, ...prev]);
      setGroupName('');
      setGroupTarget('');
      setInviteCode('');
      setShowNewGroup(false);
      load();
    } catch (e) {
      Alert.alert('Hata', e.message || 'Bir hata oluştu');
    }
  };

  const addSplitEntry = () => {
    if (!newSplitPerson.trim() || !newSplitAmount.trim()) return;
    setSplitEntries((prev) => [...prev, { id: String(Date.now()), name: newSplitPerson.trim(), amount: newSplitAmount.trim() }]);
    setNewSplitAmount('');
    setNewSplitDebts(null);
  };
  const removeSplitEntry = (id) => {
    setSplitEntries((prev) => prev.filter((e) => e.id !== id));
    setNewSplitDebts(null);
  };
  const createNewSplit = () => {
    const contributions = splitEntries.map((e) => ({ name: e.name, amount: e.amount }));
    setNewSplitDebts(computeDebts(contributions));
  };

  const splitDebts = selectedJarForSplit ? computeDebts(selectedJarForSplit.contributions || []) : [];

  const socialSuccess = '#4ade80';
  const socialDanger = '#fb7185';
  const primaryLight = '#e6f0ff';

  const [userJars, setUserJars] = useState([]);
  const [friendsList, setFriendsList] = useState(() => [...new Set(SAMPLE_JARS.flatMap((j) => j.members))].slice(0, 12));

  const friends = friendsList;
  const friendColors = ['#003399', '#1e4db7', '#2563eb', '#60a5fa', '#93c5fd'];
  const RECOMMENDATIONS = [
    {
      category: 'Otel',
      icon: 'bed-outline',
      color: '#1e4db7',
      items: [
        { name: 'Rixos Premium Belek', location: 'Antalya', rating: 4.8, price: '₺4.500/gece' },
        { name: 'Swissôtel The Bosphorus', location: 'İstanbul', rating: 4.7, price: '₺3.200/gece' },
        { name: 'Hilton Dalaman', location: 'Muğla', rating: 4.5, price: '₺2.800/gece' },
      ],
    },
    {
      category: 'Restoran',
      icon: 'restaurant-outline',
      color: '#f97316',
      items: [
        { name: 'Nusr-Et Steakhouse', location: 'İstanbul', rating: 4.6, price: '₺800/kişi' },
        { name: 'Mikla Restaurant', location: 'İstanbul', rating: 4.9, price: '₺1.200/kişi' },
        { name: 'Sunset Grill & Bar', location: 'İstanbul', rating: 4.4, price: '₺650/kişi' },
      ],
    },
    {
      category: 'Tatil Yeri',
      icon: 'location-outline',
      color: '#10b981',
      items: [
        { name: 'Kaputaş Plajı', location: 'Antalya', rating: 4.9, price: 'Ücretsiz' },
        { name: 'Pamukkale Travertenleri', location: 'Denizli', rating: 4.8, price: '₺150/kişi' },
        { name: 'Kapadokya Balon Turu', location: 'Nevşehir', rating: 5.0, price: '₺3.500/kişi' },
      ],
    },
    {
      category: 'Uçak',
      icon: 'ticket-outline',
      color: '#a855f7',
      items: [
        { name: 'İstanbul → Antalya', location: 'THY', rating: 4.7, price: '₺1.200' },
        { name: 'İstanbul → İzmir', location: 'Pegasus', rating: 4.3, price: '₺650' },
        { name: 'Ankara → Trabzon', location: 'AnadoluJet', rating: 4.2, price: '₺550' },
      ],
    },
  ];
  const jarTheme = (jar) => {
    const isSocial = jar.tagStyle === 'social';
    return {
      bg: isSocial ? '#1e4db7' : '#2563eb',
      bg2: isSocial ? '#60a5fa' : '#4f46e5',
      tagBg: 'rgba(255,255,255,0.20)',
      iconBg: 'rgba(255,255,255,0.15)',
    };
  };
  const EXTRA_JARS = [
    {
      id: '3',
      name: 'Acil Durum Fonu',
      tag: 'BİRİKİM',
      tagStyle: 'travel',
      icon: 'wallet',
      savings: 800,
      memberCount: 3,
      members: ['Ayşe', 'Bora', 'Can'],
      targetAmount: 4000,
      contributions: [
        { name: 'Ayşe', amount: 300 },
        { name: 'Bora', amount: 250 },
        { name: 'Can', amount: 250 },
      ],
    },
    {
      id: '4',
      name: 'Hafta Sonu Kaçamağı',
      tag: 'TATİL',
      tagStyle: 'travel',
      icon: 'airplane',
      savings: 620,
      memberCount: 5,
      members: ['Deniz', 'Elif', 'Fatma', 'Gül', 'Hakan'],
      targetAmount: 2000,
      contributions: [
        { name: 'Deniz', amount: 150 },
        { name: 'Elif', amount: 120 },
        { name: 'Fatma', amount: 140 },
        { name: 'Gül', amount: 110 },
        { name: 'Hakan', amount: 100 },
      ],
    },
  ];
  const displayedJars = [
    ...userJars,
    ...(showAllJars ? [...SAMPLE_JARS, ...EXTRA_JARS] : SAMPLE_JARS),
  ];

  const addFriend = () => {
    const name = newFriendName.trim();
    const iban = newFriendIban.trim();
    if (!name || !iban) return;
    setNewFriendName('');
    setNewFriendIban('');
    setShowAddFriend(false);
    setFriendRequests((prev) => [{ id: `fr-${Date.now()}`, name, iban }, ...prev]);
    Alert.alert('İstek alındı', `${name} arkadaşlık isteği attı. Kabul edebilirsin.`);
  };

  const acceptFriendRequest = (reqId) => {
    const req = friendRequests.find((r) => r.id === reqId);
    if (!req) return;
    setFriendsList((prev) => (prev.includes(req.name) ? prev : [...prev, req.name]));
    setFriendRequests((prev) => prev.filter((r) => r.id !== reqId));
  };

  const joinJar = () => {
    const code = joinCode.trim();
    const iban = joinIban.trim();
    if (!code || !iban) return;
    Alert.alert('İstek alındı', 'Katılım isteğin alındı. Yakında aktif olacak.');
    setJoinCode('');
    setJoinIban('');
    setShowJoinJar(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>İş-Gen Social</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerQrBtn} onPress={() => setSuggestionsVisible(true)} activeOpacity={0.85}>
            <Ionicons name="compass-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerQrBtn} onPress={() => setQrModalVisible(true)} activeOpacity={0.85}>
            <Ionicons name="qr-code-outline" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerQrBtn} onPress={() => setInviteHubVisible(true)} activeOpacity={0.85}>
            <Ionicons name="person-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Friends */}
      <View style={styles.section}>
        <View style={[styles.glassCard, styles.friendsCard]}>
          <View style={styles.friendsHeader}>
            <View style={styles.friendsHeaderLeft}>
              <Ionicons name="people" size={16} color={COLORS.primary} />
              <Text style={styles.friendsTitle}>Arkadaşlarım</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{friends.length}</Text>
              </View>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsRow}>
            {friends.map((name, idx) => (
              <View key={name} style={styles.friendItem}>
                <View style={[styles.friendCircle, { backgroundColor: friendColors[idx % friendColors.length] }]}>
                  <Text style={styles.friendCircleText}>{name.charAt(0)}</Text>
                </View>
                <Text style={styles.friendItemName} numberOfLines={1}>{name}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.friendItem} activeOpacity={0.85} onPress={() => setShowAddFriend(true)}>
              <View style={styles.inviteCircle}>
                <Ionicons name="add" size={18} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.friendInviteText}>Davet</Text>
            </TouchableOpacity>
          </ScrollView>

          {friendRequests.length > 0 && (
            <View style={styles.friendRequestsBox}>
              <View style={styles.friendRequestsHeader}>
                <Ionicons name="notifications-outline" size={16} color={COLORS.primary} />
                <Text style={styles.friendRequestsTitle}>Arkadaşlık istekleri</Text>
              </View>
              {friendRequests.slice(0, 3).map((r) => (
                <View key={r.id} style={styles.friendRequestRow}>
                  <View style={styles.friendRequestLeft}>
                    <Text style={styles.friendRequestName}>{r.name}</Text>
                    <Text style={styles.friendRequestSub}>arkadaşlık isteği attı</Text>
                  </View>
                  <TouchableOpacity style={styles.friendAcceptBtn} onPress={() => acceptFriendRequest(r.id)} activeOpacity={0.85}>
                    <Text style={styles.friendAcceptBtnText}>Kabul et</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Shared Jars */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Ortak Kumbaralar</Text>
          <View style={styles.jarsHeaderRight}>
            <TouchableOpacity style={styles.addLink} onPress={() => setShowNewGroup(true)} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addLinkText}>Ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addLink} onPress={() => setShowJoinJar(true)} activeOpacity={0.85}>
              <Ionicons name="log-in-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addLinkText}>Katıl</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addLink} onPress={() => setShowAllJars((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.addLinkText}>Tümünü gör</Text>
              <Ionicons name={showAllJars ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.jarsList}>
          {displayedJars.map((jar) => {
            const theme = jarTheme(jar);
            const pct = jar.targetAmount ? Math.min(100, Math.round((jar.savings / jar.targetAmount) * 100)) : 0;
            return (
              <TouchableOpacity key={jar.id} style={[styles.glassCard, styles.jarCardNew]} onPress={() => setSelectedJar(jar)} activeOpacity={0.9}>
                <View style={[styles.jarBanner, { backgroundColor: theme.bg }]}>
                  <View style={[styles.jarBannerIcon, { backgroundColor: theme.iconBg }]}>
                    <Ionicons name={jar.icon} size={24} color="#fff" />
                  </View>
                  <View style={styles.jarBannerBody}>
                    <Text style={styles.jarBannerTitle}>{jar.name}</Text>
                    <Text style={styles.jarBannerMeta}>{jar.memberCount} üye</Text>
                  </View>
                  <View style={[styles.jarTagPill, { backgroundColor: theme.tagBg }]}>
                    <Text style={styles.jarTagPillText}>{jar.tag}</Text>
                  </View>
                </View>
                <View style={styles.jarBody}>
                  <View style={styles.jarAmountsRow}>
                    <View>
                      <Text style={styles.jarMuted}>Toplanan</Text>
                      <Text style={styles.jarAmount}>{formatMoney(jar.savings)}</Text>
                    </View>
                    <Text style={styles.jarMuted}>Hedef: {formatMoney(jar.targetAmount)}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: theme.bg2 }]} />
                  </View>
                  <Text style={styles.progressPct}>%{pct}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {showNewGroup && (
        <View style={styles.card}>
          <TextInput style={styles.input} placeholder="Kumbara adı" value={groupName} onChangeText={setGroupName} placeholderTextColor={COLORS.textSecondary} />
          <TextInput style={styles.input} placeholder="Kumbara hedefi" value={groupTarget} onChangeText={setGroupTarget} keyboardType="decimal-pad" placeholderTextColor={COLORS.textSecondary} />
          <View style={styles.inviteCodeRow}>
            <TextInput
              style={styles.inviteCodeInput}
              placeholder="IBAN"
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewGroup(false)}>
              <Text style={styles.cancelBtnText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={createGroup}>
              <Text style={styles.submitBtnText}>Oluştur</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Kumbara katıl modal */}
      <Modal visible={showJoinJar} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowJoinJar(false)}>
          <View style={styles.friendModalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.friendModalTitle}>Kumbaraya Katıl</Text>
            <TextInput
              style={styles.input}
              placeholder="Kumbara davet kodu"
              value={joinCode}
              onChangeText={setJoinCode}
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="IBAN"
              value={joinIban}
              onChangeText={setJoinIban}
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="characters"
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowJoinJar(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={joinJar}>
                <Text style={styles.submitBtnText}>Katıl</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Arkadaş ekle modal */}
      <Modal visible={showAddFriend} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddFriend(false)}>
          <View style={styles.friendModalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.friendModalTitle}>Arkadaş Ekle</Text>
            <TextInput
              style={styles.input}
              placeholder="Ad Soyad"
              value={newFriendName}
              onChangeText={setNewFriendName}
              placeholderTextColor={COLORS.textSecondary}
            />
            <TextInput
              style={styles.input}
              placeholder="IBAN"
              value={newFriendIban}
              onChangeText={setNewFriendIban}
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="characters"
            />
            <View style={styles.row}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddFriend(false)}>
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={addFriend}>
                <Text style={styles.submitBtnText}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Öneriler (Otel / Restoran / Tatil) */}
      <Modal visible={suggestionsVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.suggestOverlay} activeOpacity={1} onPress={() => setSuggestionsVisible(false)}>
          <View style={styles.suggestSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.suggestHandle} />
            <View style={styles.suggestHeaderRow}>
              <View>
                <Text style={styles.suggestTitle}>Keşfet & Öneriler</Text>
                <Text style={styles.suggestSubtitle}>Sana özel seçilmiş fırsatlar</Text>
              </View>
              <TouchableOpacity style={styles.suggestCloseBtn} onPress={() => setSuggestionsVisible(false)} activeOpacity={0.85}>
                <Ionicons name="close" size={16} color="#101318" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestTabsRow}>
              {RECOMMENDATIONS.map((rec, idx) => {
                const active = activeSuggestCategory === idx;
                return (
                  <TouchableOpacity
                    key={rec.category}
                    style={[styles.suggestTab, active && { backgroundColor: rec.color, borderColor: rec.color }]}
                    onPress={() => setActiveSuggestCategory(idx)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={rec.icon} size={14} color={active ? '#fff' : '#64748b'} />
                    <Text style={[styles.suggestTabText, active && styles.suggestTabTextActive]}>{rec.category}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.suggestList} contentContainerStyle={styles.suggestListContent}>
              {RECOMMENDATIONS[activeSuggestCategory]?.items?.map((item) => (
                <TouchableOpacity key={item.name} style={styles.suggestItemCard} activeOpacity={0.9}>
                  <View style={[styles.suggestItemIconBox, { backgroundColor: RECOMMENDATIONS[activeSuggestCategory].color }]}>
                    <Ionicons name={RECOMMENDATIONS[activeSuggestCategory].icon} size={18} color="#fff" />
                  </View>
                  <View style={styles.suggestItemBody}>
                    <Text style={styles.suggestItemTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.suggestItemSub}>{item.location}</Text>
                  </View>
                  <View style={styles.suggestItemRight}>
                    <View style={styles.suggestRatingRow}>
                      <Ionicons name="star" size={12} color="#fbbf24" />
                      <Text style={styles.suggestRatingText}>{item.rating}</Text>
                    </View>
                    <Text style={styles.suggestPriceText}>{item.price}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Davetler hub (Kumbara / Arkadaş) */}
      <Modal visible={inviteHubVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setInviteHubVisible(false)}>
          <View style={styles.inviteHubContent} onStartShouldSetResponder={() => true}>
            <View style={styles.inviteHubHeader}>
              <View>
                <Text style={styles.inviteHubTitle}>Davetler</Text>
                <Text style={styles.inviteHubSub}>Kumbara ve arkadaş davetleri</Text>
              </View>
              <TouchableOpacity style={styles.inviteHubClose} onPress={() => setInviteHubVisible(false)} activeOpacity={0.85}>
                <Ionicons name="close" size={18} color="#101318" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inviteHubScroll}>
              <View style={styles.inviteHubSection}>
                <View style={styles.inviteHubSectionHeader}>
                  <Ionicons name="wallet-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.inviteHubSectionTitle}>Kumbara davetleri</Text>
                </View>
                {[
                  { jar: 'Yaz Tatili 2024', code: 'IGS-1204' },
                  { jar: 'Yemek Kumbarası', code: 'IGS-4500-A' },
                ].map((x) => (
                  <View key={x.code} style={styles.inviteHubRow}>
                    <View style={styles.inviteHubRowLeft}>
                      <Text style={styles.inviteHubRowTitle}>{x.jar}</Text>
                      <Text style={styles.inviteHubRowSub}>Davet kodu</Text>
                    </View>
                    <View style={styles.inviteHubPill}>
                      <Text style={styles.inviteHubPillText}>{x.code}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={[styles.inviteHubSection, styles.inviteHubSectionPlain]}>
                <View style={styles.inviteHubSectionHeader}>
                  <Ionicons name="people-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.inviteHubSectionTitle}>Arkadaş davetleri</Text>
                </View>
                {[
                  { title: 'Hızlı davet', code: 'FRD-9K2M' },
                  { title: 'Paylaşılabilir link', code: 'FRD-LINK-2026' },
                ].map((x, idx) => (
                  <View key={x.code} style={[styles.inviteHubRow, idx === 0 && styles.inviteHubRowFirst]}>
                    <View style={styles.inviteHubRowLeft}>
                      <Text style={styles.inviteHubRowTitle}>{x.title}</Text>
                      <Text style={styles.inviteHubRowSub}>Davet kodu</Text>
                    </View>
                    <View style={styles.inviteHubPillSoft}>
                      <Text style={styles.inviteHubPillText}>{x.code}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* QR / Davet kodu modal */}
      <Modal visible={qrModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setQrModalVisible(false)}>
          <View style={styles.qrModalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.qrModalTitle}>Senin davet kodun</Text>
            <View style={styles.qrCodeBox}>
              <View style={styles.qrCodePlaceholder}>
                <Ionicons name="qr-code" size={120} color="#101318" />
              </View>
            </View>
            <TouchableOpacity style={styles.qrModalClose} onPress={() => setQrModalVisible(false)}>
              <Text style={styles.qrModalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Kumbara detay modal */}
      <Modal visible={!!selectedJar} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedJar(null)}>
          {selectedJar && (
            <View style={styles.jarDetailContent} onStartShouldSetResponder={() => true}>
              <View style={styles.jarDetailHeader}>
                <Text style={styles.jarDetailTitle}>{selectedJar.name}</Text>
                <TouchableOpacity onPress={() => setSelectedJar(null)}>
                  <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.jarDetailRow}>
                <Text style={styles.jarDetailLabel}>Hedef tutar</Text>
                <Text style={styles.jarDetailValue}>{formatMoney(selectedJar.targetAmount)}</Text>
              </View>
              <View style={styles.jarDetailRow}>
                <Text style={styles.jarDetailLabel}>Birikim</Text>
                <Text style={styles.jarDetailValue}>{formatMoney(selectedJar.savings)}</Text>
              </View>
              <View style={styles.jarDetailRow}>
                <Text style={styles.jarDetailLabel}>Kim ne kadar ekledi</Text>
              </View>
              <View style={styles.jarDetailMembers}>
                {(selectedJar.contributions || selectedJar.members.map((m) => ({ name: m, amount: 0 }))).map((c) => (
                  <View key={c.name} style={styles.jarDetailMemberRow}>
                    <View style={styles.debtAvatar}><Text style={styles.debtAvatarText}>{c.name.charAt(0)}</Text></View>
                    <Text style={styles.jarDetailMemberName}>{c.name}</Text>
                    <Text style={styles.jarDetailContribution}>{formatMoney(c.amount)} ekledi</Text>
                  </View>
                ))}
              </View>
              <View style={styles.inviteCodesBox}>
                <Text style={styles.inviteCodesTitle}>Davet kodları</Text>
                {((selectedJar.inviteCodes && selectedJar.inviteCodes.length) ? selectedJar.inviteCodes : [`IGS-${String(selectedJar.id).slice(-4)}`]).map((code) => (
                  <View key={code} style={styles.inviteCodePill}>
                    <Text style={styles.inviteCodePillText}>{code}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.qrModalClose} onPress={() => setSelectedJar(null)}>
                <Text style={styles.qrModalCloseText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* QuickSplit */}
      <View style={styles.debtSection}>
        <View style={[styles.glassCard, styles.quickSplitCard]}>
        <View style={styles.quickSplitTop}>
          <View style={styles.quickSplitIconBox}>
            <Ionicons name="flash" size={16} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.quickSplitTitle}>QuickSplit</Text>
          </View>
        </View>
        <View style={styles.quickSplitBtnsRow}>
          <TouchableOpacity
            style={[splitSource === 'yeni' ? styles.quickSplitBtnOutline : styles.quickSplitBtnPrimary, splitSource === 'kumbara' && styles.quickSplitBtnPrimaryOn]}
            onPress={() => setSplitSource('kumbara')}
            activeOpacity={0.9}
          >
            <Text style={splitSource === 'yeni' ? styles.quickSplitBtnOutlineText : styles.quickSplitBtnPrimaryText}>Kumbaradan al</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[splitSource === 'yeni' ? styles.quickSplitBtnPrimary : styles.quickSplitBtnOutline, splitSource === 'yeni' && styles.quickSplitBtnPrimaryOn]}
            onPress={() => setSplitSource('yeni')}
            activeOpacity={0.9}
          >
            <Text style={splitSource === 'yeni' ? styles.quickSplitBtnPrimaryText : styles.quickSplitBtnOutlineText}>Yeni split</Text>
          </TouchableOpacity>
        </View>

        {splitSource === 'kumbara' && (
          <View style={styles.splitCard}>
            <Text style={styles.splitCardTitle}>Kumbara seç</Text>
            {SAMPLE_JARS.map((jar) => (
              <TouchableOpacity
                key={jar.id}
                style={[styles.splitKumbaraRow, selectedJarForSplit?.id === jar.id && styles.splitKumbaraRowSelected]}
                onPress={() => setSelectedJarForSplit(selectedJarForSplit?.id === jar.id ? null : jar)}
              >
                <View style={styles.splitKumbaraLeft}>
                  <View style={[styles.splitKumbaraDot, { backgroundColor: jarTheme(jar).bg }]} />
                  <Text style={styles.splitKumbaraName}>{jar.name}</Text>
                </View>
                <Text style={styles.jarMeta}>{formatMoney(jar.savings)} birikim</Text>
              </TouchableOpacity>
            ))}
            {selectedJarForSplit && (
              <View style={styles.splitDebtBlock}>
                <Text style={styles.splitCardTitle}>Kim kime ne kadar borçlu</Text>
                {splitDebts.length === 0 ? (
                  <Text style={styles.splitDebtEmpty}>Herkes eşit ödedi, borç yok.</Text>
                ) : (
                  splitDebts.map((d, idx) => (
                    <View key={idx} style={styles.debtCard}>
                      <View style={styles.debtLeft}>
                        <View style={styles.debtAvatarWrap}>
                          <View style={styles.debtAvatar}><Text style={styles.debtAvatarText}>{d.from.charAt(0)}</Text></View>
                          <View style={styles.debtBadgeGreen}>
                            <Ionicons name="arrow-forward" size={10} color="#fff" />
                          </View>
                        </View>
                        <View>
                          <Text style={styles.debtTitle}>{d.from}, {d.to}'ye borçlu</Text>
                          <Text style={styles.debtSub}>Split</Text>
                        </View>
                      </View>
                      <View style={styles.debtRight}>
                        <Text style={styles.debtAmountGreen}>{formatMoney(d.amount)}</Text>
                        <TouchableOpacity style={styles.settleBtn}><Text style={styles.settleBtnText}>Ödeş</Text></TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {splitSource === 'yeni' && (
          <View style={styles.splitCard}>
            <Text style={styles.splitCardTitle}>Kişiler ve ödenen tutarlar</Text>
            <TouchableOpacity
              style={styles.selectBox}
              onPress={() => setShowPersonPicker(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.selectBoxText, !newSplitPerson && styles.selectBoxTextPlaceholder]}>
                {newSplitPerson || 'Kişi seç'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#0b1b3d" />
            </TouchableOpacity>
            <View style={styles.splitInputRow}>
              <TextInput
                style={styles.splitAmountInput}
                placeholder="Tutar"
                value={newSplitAmount}
                onChangeText={setNewSplitAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity style={styles.splitAddBtn} onPress={addSplitEntry}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {splitEntries.map((e) => (
              <View key={e.id} style={styles.splitEntryRow}>
                <View>
                  <Text style={styles.debtTitle}>{e.name}</Text>
                  <Text style={styles.debtSub}>{formatMoney(parseFloat(e.amount) || 0)} ödedi</Text>
                </View>
                <TouchableOpacity onPress={() => removeSplitEntry(e.id)}>
                  <Ionicons name="trash-outline" size={20} color={socialDanger} />
                </TouchableOpacity>
              </View>
            ))}
            {splitEntries.length >= 2 && (
              <TouchableOpacity style={styles.splitCreateBtn} onPress={createNewSplit}>
                <Text style={styles.splitCreateBtnText}>Oluştur</Text>
              </TouchableOpacity>
            )}
            {newSplitDebts !== null && (
              <View style={styles.splitDebtBlock}>
                <Text style={styles.splitCardTitle}>Kim kime ne kadar borçlu</Text>
                {newSplitDebts.length === 0 ? (
                  <Text style={styles.splitDebtEmpty}>Herkes eşit ödedi, borç yok.</Text>
                ) : (
                  newSplitDebts.map((d, idx) => (
                    <View key={idx} style={styles.debtCard}>
                      <View style={styles.debtLeft}>
                        <View style={styles.debtAvatarWrap}>
                          <View style={styles.debtAvatar}><Text style={styles.debtAvatarText}>{d.from.charAt(0)}</Text></View>
                          <View style={styles.debtBadgeGreen}><Ionicons name="arrow-forward" size={10} color="#fff" /></View>
                        </View>
                        <View>
                          <Text style={styles.debtTitle}>{d.from}, {d.to}'ye borçlu</Text>
                          <Text style={styles.debtSub}>Split</Text>
                        </View>
                      </View>
                      <View style={styles.debtRight}>
                        <Text style={styles.debtAmountGreen}>{formatMoney(d.amount)}</Text>
                        <TouchableOpacity style={styles.settleBtn}><Text style={styles.settleBtnText}>Ödeş</Text></TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

        <Modal
          visible={showPersonPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPersonPicker(false)}
        >
          <TouchableOpacity
            style={styles.sheetOverlay}
            activeOpacity={1}
            onPress={() => setShowPersonPicker(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.sheetCard} onPress={() => {}}>
              <Text style={styles.sheetTitle}>Kişi seç</Text>
              <View style={styles.sheetList}>
                {['Kendim', ...friends].map((p) => {
                  const selected = newSplitPerson === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.sheetItem, selected && styles.sheetItemSelected]}
                      onPress={() => {
                        setNewSplitPerson(p);
                        setNewSplitDebts(null);
                        setShowPersonPicker(false);
                      }}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.sheetItemText, selected && styles.sheetItemTextSelected]}>{p}</Text>
                      {selected && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
          </View>
        )}

        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: '#0b1b3d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerQrBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101318', marginBottom: 12 },
  jarsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  glassCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    borderRadius: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  friendsCard: { padding: 16 },
  friendsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  friendsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendsTitle: { fontSize: 15, fontWeight: '900', color: '#101318' },
  countPill: { backgroundColor: '#eef2f7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  addLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addLinkText: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  friendsRow: { flexDirection: 'row', gap: 12, paddingBottom: 4, paddingRight: 6 },
  friendItem: { alignItems: 'center', width: 56 },
  friendCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  friendCircleText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  friendItemName: { fontSize: 11, fontWeight: '600', color: '#101318', marginTop: 6 },
  inviteCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  friendInviteText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, marginTop: 6 },
  friendRequestsBox: { marginTop: 14, backgroundColor: '#f9fafb', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#eef2f7' },
  friendRequestsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  friendRequestsTitle: { fontSize: 13, fontWeight: '900', color: '#101318' },
  friendRequestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  friendRequestLeft: { flex: 1, paddingRight: 12 },
  friendRequestName: { fontSize: 13, fontWeight: '800', color: '#101318' },
  friendRequestSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  friendAcceptBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  friendAcceptBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  jarsList: { gap: 12 },
  jarCardNew: { overflow: 'hidden' },
  jarBanner: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  jarBannerIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  jarBannerBody: { flex: 1 },
  jarBannerTitle: { fontSize: 13, fontWeight: '800', color: '#fff' },
  jarBannerMeta: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  jarTagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  jarTagPillText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  jarBody: { padding: 16 },
  jarAmountsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  jarMuted: { fontSize: 11, color: COLORS.textSecondary },
  jarAmount: { fontSize: 16, fontWeight: '800', color: '#101318', marginTop: 2 },
  progressTrack: { height: 8, backgroundColor: '#eef2f7', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressPct: { fontSize: 10, color: COLORS.textSecondary, marginTop: 6, textAlign: 'right' },
  jarCard: { width: 256, flexShrink: 0 },
  jarImageWrap: { height: 176, borderRadius: RADIUS['2xl'], overflow: 'hidden', marginBottom: 12, backgroundColor: COLORS.primary, position: 'relative' },
  jarImageWrapGreen: { backgroundColor: '#059669' },
  jarImageGradient: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  jarIconWrap: { position: 'absolute', top: 12, right: 12, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  jarTagWrap: { position: 'absolute', bottom: 12, left: 12 },
  jarTagTravel: { backgroundColor: 'rgba(0,51,153,0.9)', color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, overflow: 'hidden' },
  jarTagSocial: { backgroundColor: 'rgba(74,222,128,0.9)', color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, overflow: 'hidden' },
  jarTitle: { fontWeight: '600', fontSize: 14, color: '#101318' },
  jarMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  jarMeta: { fontSize: 12, color: COLORS.textSecondary },
  jarAvatars: { flexDirection: 'row' },
  jarAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  jarA1: { backgroundColor: '#86efac' },
  jarA2: { backgroundColor: '#93c5fd', marginLeft: -8 },
  jarAvatarText: { fontSize: 10, fontWeight: '700', color: '#101318' },
  jarAvatarPlus: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e5e7eb', marginLeft: -8, justifyContent: 'center', alignItems: 'center' },
  jarAvatarPlusText: { fontSize: 8, fontWeight: '700', color: '#4b5563' },
  card: { marginHorizontal: 16, marginBottom: 16, padding: 16, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10, marginBottom: 12 },
  inviteCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  inviteCodeInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10 },
  row: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: COLORS.border, borderRadius: 8 },
  cancelBtnText: { color: '#101318' },
  submitBtn: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 8 },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  debtSection: { marginTop: 20, paddingHorizontal: 16 },
  quickSplitCard: { padding: 16 },
  quickSplitTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  quickSplitIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(0,51,153,0.10)', justifyContent: 'center', alignItems: 'center' },
  quickSplitTitle: { fontSize: 16, fontWeight: '900', color: '#101318' },
  quickSplitBtnsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  quickSplitBtnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  quickSplitBtnPrimaryOn: { opacity: 1 },
  quickSplitBtnPrimaryText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  quickSplitBtnOutline: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  quickSplitBtnOutlineOn: { backgroundColor: 'rgba(0,51,153,0.06)' },
  quickSplitBtnOutlineText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  quickSplitBtnOutlineTextOn: { color: COLORS.primary },
  quickSplitJarList: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, gap: 10 },
  quickSplitJarRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickSplitDot: { width: 8, height: 8, borderRadius: 4 },
  quickSplitJarName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#101318' },
  quickSplitJarAmt: { fontSize: 12, color: COLORS.textSecondary },
  debtCardWrap: { backgroundColor: '#f9fafb', borderRadius: RADIUS['2xl'], padding: 16, gap: 12 },
  debtCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  debtLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  debtAvatarWrap: { position: 'relative' },
  debtAvatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  debtAvatarText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  debtBadgeGreen: { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#4ade80', borderWidth: 2, borderColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  debtBadgeRed: { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fb7185', borderWidth: 2, borderColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  debtTitle: { fontWeight: '700', fontSize: 14, color: '#101318' },
  debtSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  debtRight: { alignItems: 'flex-end' },
  debtAmountGreen: { fontWeight: '800', fontSize: 16, color: '#4ade80' },
  debtAmountRed: { fontWeight: '800', fontSize: 16, color: '#fb7185' },
  settleBtn: { marginTop: 4, paddingVertical: 4, paddingHorizontal: 12, backgroundColor: '#e6f0ff', borderRadius: RADIUS.full },
  settleBtnText: { fontSize: 10, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  payBtn: { marginTop: 4, paddingVertical: 6, paddingHorizontal: 16, backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  payBtnText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  // QR modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  qrModalContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 24, alignItems: 'center' },
  qrModalTitle: { fontSize: 18, fontWeight: '700', color: '#101318', marginBottom: 20 },
  qrCodeBox: { padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 20 },
  qrCodePlaceholder: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8 },
  qrModalClose: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: COLORS.primary, borderRadius: 12 },
  qrModalCloseText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  // Invite hub
  inviteHubContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 18, width: '100%', maxWidth: 380, alignSelf: 'center' },
  inviteHubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  inviteHubTitle: { fontSize: 18, fontWeight: '900', color: '#101318' },
  inviteHubSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  inviteHubClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  inviteHubScroll: { paddingBottom: 6, gap: 14 },
  inviteHubSection: { backgroundColor: '#f9fafb', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  inviteHubSectionPlain: { backgroundColor: '#fff', borderColor: '#eef2f7' },
  inviteHubSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  inviteHubSectionTitle: { fontSize: 14, fontWeight: '800', color: '#101318' },
  inviteHubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  inviteHubRowFirst: { borderTopWidth: 0, paddingTop: 0 },
  inviteHubRowLeft: { flex: 1, paddingRight: 10 },
  inviteHubRowTitle: { fontSize: 13, fontWeight: '700', color: '#101318' },
  inviteHubRowSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  inviteHubPill: { backgroundColor: 'rgba(0,51,153,0.10)', borderWidth: 1, borderColor: 'rgba(0,51,153,0.18)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  inviteHubPillSoft: { backgroundColor: '#eaf2ff', borderWidth: 1, borderColor: '#cfe0ff', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  inviteHubPillText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  // Suggestions modal (Keşfet & Öneriler)
  suggestOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.60)', justifyContent: 'flex-end' },
  suggestSheet: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    maxHeight: '85%',
  },
  suggestHandle: { width: 44, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 10, opacity: 0.8 },
  suggestHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  suggestTitle: { fontSize: 18, fontWeight: '900', color: '#101318' },
  suggestSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '600' },
  suggestCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2f7', alignItems: 'center', justifyContent: 'center' },
  suggestTabsRow: { gap: 10, paddingBottom: 8 },
  suggestTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#eef2f7',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestTabText: { fontSize: 12, fontWeight: '800', color: '#64748b' },
  suggestTabTextActive: { color: '#fff' },
  suggestList: { marginTop: 8 },
  suggestListContent: { paddingBottom: 22, gap: 12 },
  suggestItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  suggestItemIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  suggestItemBody: { flex: 1, minWidth: 0 },
  suggestItemTitle: { fontSize: 14, fontWeight: '900', color: '#101318' },
  suggestItemSub: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 2 },
  suggestItemRight: { alignItems: 'flex-end' },
  suggestRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  suggestRatingText: { fontSize: 12, fontWeight: '800', color: '#101318' },
  suggestPriceText: { fontSize: 12, fontWeight: '900', color: COLORS.primary },
  // Kumbara detay modal
  jarDetailContent: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 24, width: '100%', maxWidth: 360 },
  jarDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  jarDetailTitle: { fontSize: 20, fontWeight: '700', color: '#101318', flex: 1 },
  jarDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  jarDetailLabel: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  jarDetailValue: { fontSize: 16, fontWeight: '700', color: '#101318' },
  jarDetailMembers: { marginBottom: 20 },
  jarDetailMemberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  jarDetailMemberName: { fontSize: 15, color: '#101318', fontWeight: '500', flex: 1 },
  jarDetailContribution: { fontSize: 14, color: '#059669', fontWeight: '600' },
  inviteCodesBox: {
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inviteCodesTitle: { width: '100%', fontSize: 13, fontWeight: '700', color: '#101318', marginBottom: 2 },
  inviteCodePill: {
    backgroundColor: 'rgba(0,51,153,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,51,153,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  inviteCodePillText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  friendModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  friendModalTitle: { fontSize: 16, fontWeight: '800', color: '#101318', marginBottom: 12 },
  // QuickSplit
  splitSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12 },
  splitOptionsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  splitOptionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  splitOptionBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  splitOptionText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  splitOptionTextActive: { color: '#fff' },
  splitCard: { backgroundColor: '#f9fafb', borderRadius: RADIUS.xl, padding: 16, marginBottom: 16 },
  splitCardTitle: { fontSize: 14, fontWeight: '700', color: '#101318', marginBottom: 12 },
  splitKumbaraRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  splitKumbaraRowSelected: { backgroundColor: 'rgba(0,51,153,0.08)', borderRadius: 8 },
  splitKumbaraLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitKumbaraDot: { width: 8, height: 8, borderRadius: 4 },
  splitKumbaraName: { fontWeight: '600', fontSize: 14, color: '#101318' },
  splitDebtBlock: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  splitDebtEmpty: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 8 },
  splitDebtRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  splitDebtArrow: { marginRight: 0 },
  splitDebtText: { flex: 1, fontSize: 14, color: '#101318' },
  splitDebtFrom: { fontWeight: '700' },
  splitDebtTo: { fontWeight: '600', color: COLORS.primary },
  splitDebtAmount: { fontWeight: '700', color: '#059669' },
  splitInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    marginBottom: 12,
  },
  selectBoxText: { fontSize: 14, fontWeight: '700', color: '#0b1b3d' },
  selectBoxTextPlaceholder: { color: COLORS.textSecondary, fontWeight: '600' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sheetTitle: { fontSize: 13, fontWeight: '800', color: '#0b1b3d', marginBottom: 10 },
  sheetList: { gap: 8, paddingBottom: 6 },
  sheetItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  sheetItemSelected: { backgroundColor: 'rgba(0,51,153,0.07)', borderColor: 'rgba(0,51,153,0.22)' },
  sheetItemText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sheetItemTextSelected: { color: COLORS.primary },
  peoplePickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  peopleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#eef2f7',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  peopleChipSelected: { backgroundColor: 'rgba(0,51,153,0.10)', borderColor: 'rgba(0,51,153,0.25)' },
  peopleChipText: { fontSize: 12, fontWeight: '700', color: '#101318' },
  peopleChipTextSelected: { color: COLORS.primary },
  splitAmountInput: { width: 90, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10 },
  splitAddBtn: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  splitCreateBtn: { marginTop: 16, paddingVertical: 14, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center' },
  splitCreateBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  splitEntryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
});
