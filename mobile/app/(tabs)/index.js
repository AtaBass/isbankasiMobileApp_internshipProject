import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../lib/storage';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { dashboard as api, goals as goalsApi } from '../../lib/api';
import { ProgressBar } from '../../components/ProgressBar';

function formatMoney(n) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n);
}

// Örnek işlemler (Recent Activity görseli gibi)
const SAMPLE_ACTIVITY = [
  { id: 's1', title: 'Burger King', date: 'Dün, 20:45', amount: -12.4, icon: 'fast-food' },
  { id: 's2', title: 'Annemden transfer', date: 'Dün, 13:20', amount: 50, icon: 'arrow-down-circle' },
  { id: 's3', title: 'Zara', date: '24 Eki, 16:15', amount: -45, icon: 'bag-handle-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newGoalVisible, setNewGoalVisible] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [notifVisible, setNotifVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('summary');

  const [moneySplitterOn, setMoneySplitterOn] = useState(true);
  const [splits, setSplits] = useState([
    { id: '1', name: 'Hesap', pct: 50, icon: 'business-outline', color: '#60a5fa' },
    { id: '2', name: 'Yatırım fonu', pct: 30, icon: 'trending-up-outline', color: '#34d399' },
    { id: '3', name: 'Tatil hedefi', pct: 20, icon: 'airplane-outline', color: '#fbbf24' },
  ]);
  const SPLIT_ICONS = ['business-outline', 'trending-up-outline', 'airplane-outline', 'school-outline', 'cash-outline'];
  const SPLIT_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb7185'];

  const totalSplitPct = splits.reduce((s, x) => s + x.pct, 0);

  const updateSplitPct = (id, newPct) => {
    const n = Math.max(0, Math.min(100, Number(newPct) || 0));
    setSplits((prev) => prev.map((x) => (x.id === id ? { ...x, pct: n } : x)));
  };

  const updateSplitName = (id, name) => {
    setSplits((prev) => prev.map((x) => (x.id === id ? { ...x, name } : x)));
  };

  const addSplit = () => {
    setSplits((prev) => {
      const idx = prev.length % SPLIT_COLORS.length;
      return [...prev, { id: String(Date.now()), name: 'Yeni', pct: 0, icon: SPLIT_ICONS[idx], color: SPLIT_COLORS[idx] }];
    });
  };

  const removeSplit = (id) => {
    const item = splits.find((x) => x.id === id);
    if (!item || splits.length <= 1) return;
    setSplits((prev) => prev.filter((x) => x.id !== id));
  };

  const SplitSlider = ({ value, onChange, color }) => {
    const trackRef = useRef(null);
    const [w, setW] = useState(0);
    const pct = Math.max(0, Math.min(100, Number(value) || 0));

    const updateFromLocationX = (locationX) => {
      if (!w) return;
      const x = Math.max(0, Math.min(w, locationX));
      const next = Math.round((x / w) * 100);
      onChange(Math.max(0, Math.min(100, next)));
    };

    return (
      <View
        ref={trackRef}
        style={styles.splitSliderTrack}
        onLayout={(e) => {
          setW(e.nativeEvent.layout.width);
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => updateFromLocationX(e.nativeEvent.locationX)}
        onResponderMove={(e) => updateFromLocationX(e.nativeEvent.locationX)}
      >
        <View style={[styles.splitSliderFill, { width: `${pct}%`, backgroundColor: color || COLORS.primary }]} />
        <View style={[styles.splitSliderThumb, { left: `${pct}%`, borderColor: color || COLORS.primary }]} />
      </View>
    );
  };

  const load = async () => {
    try {
      const d = await api.get();
      setData(d);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const balance = Number(data?.balance ?? 0);
  const activeGoals = data?.active_goals ?? [];
  const transactions = data?.recent_transactions ?? [];
  const points = Number(data?.points?.available ?? 0);
  const firstName = data?.full_name?.split(' ')[0] || 'Kullanıcı';

  // AI insight – Hoşgeldin kampanyası
  const aiInsight = 'Yeni Gelenler için Düşük Faizli Kredi Fırsatı';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {/* Header Section - sticky style */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')} activeOpacity={0.8}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color="#fff" />
              <TextInput
                style={styles.searchInput}
                placeholder="MaxiRota'da Ara"
                placeholderTextColor="#fff"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="star" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setNotifVisible(true)}>
                <Ionicons name="notifications-outline" size={24} color="#fff" />
                <View style={styles.notifDot} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.topTabs}>
            <TouchableOpacity
              style={[styles.topTabBtn, activeTab === 'summary' && styles.topTabActive]}
              onPress={() => setActiveTab('summary')}
            >
              <View style={styles.topTabIcon}>
                <Ionicons name="stats-chart" size={20} color={activeTab === 'summary' ? '#fff' : 'rgba(0,153,255,0.9)'} />
              </View>
              <Text style={[styles.topTabLabel, activeTab === 'summary' && styles.topTabLabelActive]}>Özetim</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.topTabBtn, activeTab === 'goals' && styles.topTabActive]}
              onPress={() => setActiveTab('goals')}
            >
              <View style={styles.topTabIcon}>
                <Ionicons name="flag" size={20} color={activeTab === 'goals' ? '#fff' : 'rgba(0,153,255,0.9)'} />
              </View>
              <Text style={[styles.topTabLabel, activeTab === 'goals' && styles.topTabLabelActive]}>Hedefler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.topTabBtn, activeTab === 'splitter' && styles.topTabActive]}
              onPress={() => setActiveTab('splitter')}
            >
              <View style={styles.topTabIcon}>
                <Ionicons name="git-compare" size={20} color={activeTab === 'splitter' ? '#fff' : 'rgba(0,153,255,0.9)'} />
              </View>
              <Text style={[styles.topTabLabel, activeTab === 'splitter' && styles.topTabLabelActive]}>Splitter</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'summary' && (
          <>
            {/* Balance Hero */}
            <View style={styles.balanceSection}>
              <View style={styles.balanceCard}>
                <View style={styles.balanceGlow} />
                <View style={styles.balanceInner}>
                    <Text style={styles.balanceLabel}>Toplam Birikim</Text>
                  <Text style={styles.balanceAmount}>{formatMoney(balance)}</Text>
                  <View style={styles.progressRow}>
                    <Text style={styles.progressLabel}>HAFTALIK İLERLEME</Text>
                    <Text style={styles.progressValue}>bu hafta +%12,5</Text>
                  </View>
                  <TouchableOpacity style={[styles.detailsBtn, styles.detailsBtnSmall]} activeOpacity={0.9}>
                    <Text style={styles.detailsBtnText}>Detaylar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickSection}>
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/send')}>
                  <View style={styles.quickIconCircle}>
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.text} />
                  </View>
                  <Text style={styles.quickLabel}>Para Aktar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn}>
                  <View style={styles.quickIconCircle}>
                    <Ionicons name="camera" size={20} color={COLORS.text} />
                  </View>
                  <Text style={styles.quickLabel}>Ödeme Yap</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn}>
                  <View style={styles.quickIconCircle}>
                    <Ionicons name="share-social" size={20} color={COLORS.text} />
                  </View>
                  <Text style={styles.quickLabel}>IBAN Paylaş</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn}>
                  <View style={styles.quickIconCircle}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.text} />
                  </View>
                  <Text style={styles.quickLabel}>Daha Fazlası</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Aylık Özet */}
            <View style={styles.monthlySummaryWrap}>
              <View style={[styles.glassCard, styles.monthlySummary]}>
                <View style={styles.monthlySummaryHeader}>
                  <View style={styles.monthlySummaryIconWrap}>
                    <Ionicons name="bar-chart-outline" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.monthlySummaryTitle}>Aylık Özet</Text>
                </View>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <View style={[styles.statCard, styles.statCardMuted]}>
                      <Text style={styles.summaryCardLabel}>Otomatik ayrılan</Text>
                      <Text style={styles.summaryCardValue}>2.400 TL</Text>
                    </View>
                  </View>
                  <View style={styles.summaryCard}>
                    <View style={[styles.statCard, styles.statCardPrimarySoft]}>
                      <Text style={styles.summaryCardLabel}>Cashback</Text>
                      <Text style={[styles.summaryCardValue, styles.summaryCardValuePrimary]}>180 TL</Text>
                    </View>
                  </View>
                  <View style={styles.summaryCard}>
                    <View style={[styles.statCard, styles.statCardDangerSoft]}>
                      <Text style={styles.summaryCardLabel}>Borç/Alacak net</Text>
                      <Text style={[styles.summaryCardValue, styles.summaryCardValueDanger]}>-250 TL</Text>
                    </View>
                  </View>
                  <View style={styles.summaryCard}>
                    <View style={[styles.statCard, styles.statCardPrimarySoft]}>
                      <Text style={styles.summaryCardLabel}>Görev puanı</Text>
                      <Text style={[styles.summaryCardValue, styles.summaryCardValuePrimary]}>{points} puan</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Hoşgeldin Kampanyası */}
            <View style={styles.aiSection}>
              <View style={[styles.glassCard, styles.campaignCard]}>
                <View style={styles.campaignIconWrap}>
                  <Ionicons name="cash-outline" size={18} color={COLORS.textSecondary} />
                </View>
                <View style={styles.campaignBody}>
                  <Text style={styles.campaignTitle}>Hoşgeldin Kampanyası</Text>
                  <Text style={styles.campaignText}>{aiInsight}</Text>
                </View>
                <View style={styles.campaignBadge}>
                  <Text style={styles.campaignBadgeText}>Canlı</Text>
                </View>
              </View>
            </View>

            {/* Son İşlemler */}
            <View style={styles.activitySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Son İşlemler</Text>
                <TouchableOpacity>
                  <Text style={styles.sectionLink}>Geçmiş</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.activityList}>
                {(transactions.length > 0 ? transactions.slice(0, 5) : SAMPLE_ACTIVITY).map((t) => {
                  const isApi = transactions.length > 0 && t.created_at;
                  const amount = isApi ? Number(t.amount) : t.amount;
                  const title = isApi ? (t.description || t.category || 'İşlem') : t.title;
                  const dateStr = isApi
                    ? `${new Date(t.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}, ${new Date(t.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
                    : t.date;
                  const iconName = isApi ? (amount > 0 ? 'arrow-down-circle' : 'cart-outline') : t.icon;
                  return (
                    <View key={t.id} style={[styles.glassCard, styles.activityRow]}>
                      <View style={styles.activityIcon}>
                        <Ionicons
                          name={iconName}
                          size={20}
                          color={amount > 0 ? COLORS.success : COLORS.textSecondary}
                        />
                      </View>
                      <View style={styles.activityBody}>
                        <Text style={styles.activityDesc}>{title}</Text>
                        <Text style={styles.activityDate}>{dateStr}</Text>
                      </View>
                      <Text style={[styles.activityAmount, amount > 0 && styles.activityAmountGreen]}>
                        {amount > 0 ? '+' : ''}{formatMoney(amount)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {activeTab === 'goals' && (
          <View style={styles.goalsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Aktif Hedefler</Text>
              <TouchableOpacity onPress={() => setNewGoalVisible(true)}>
                <Text style={styles.sectionLink}>Yeni Hedef</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.goalsList}>
              {(activeGoals.length ? activeGoals : [
                { id: 'd1', name: 'Acil Durum Fonu', target_amount: 10000, current_amount: 2500 },
                { id: 'd2', name: 'Yaz Tatili', target_amount: 1500, current_amount: 800 },
              ]).map((g, idx) => {
                const target = Number(g.target_amount) || 1;
                const current = Number(g.current_amount) || 0;
                const pct = Math.min(100, Math.round((current / target) * 100));

                const themeIndex = idx % 3;
                const theme =
                  themeIndex === 0
                    ? { icon: 'flash', bg: '#ffedd5', color: '#ea580c' }
                    : themeIndex === 1
                    ? { icon: 'sunny', bg: '#dbeafe', color: '#2563eb' }
                    : { icon: 'wallet', bg: '#f3e8ff', color: COLORS.purple };

                return (
                  <View key={g.id} style={styles.goalCard}>
                    <View style={styles.goalCardHead}>
                      <View style={styles.goalCardLeft}>
                        <View style={[styles.goalIconWrap, { backgroundColor: theme.bg }]}>
                          <Ionicons name={theme.icon} size={24} color={theme.color} />
                        </View>
                        <View>
                          <Text style={styles.goalName}>{g.name}</Text>
                          <Text style={styles.goalSubtitle}>
                            {pct}% / {formatMoney(target)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.goalAmountWrap}>
                        <Text style={styles.goalAmount}>{formatMoney(current)}</Text>
                      </View>
                    </View>
                    <ProgressBar
                      progress={pct}
                      height={10}
                      color={COLORS.primary}
                      style={styles.goalBar}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {activeTab === 'splitter' && (
          <View style={styles.splitterSection}>
            <View style={styles.splitterHeaderCard}>
              <View style={styles.splitterHeaderOrn1} />
              <View style={styles.splitterHeaderOrn2} />

              <View style={styles.splitterHeaderTopRow}>
                <View style={styles.splitterHeaderLeft}>
                  <View style={styles.splitterHeaderIconBox}>
                    <Ionicons name="pie-chart-outline" size={18} color="#fff" />
                  </View>
                  <View>
                    <Text style={styles.splitterHeaderTitle}>Splitter</Text>
                    <Text style={styles.splitterHeaderSub}>Gelen parayı otomatik dağıt</Text>
                  </View>
                </View>
                <View style={styles.splitterHeaderRight}>
                  <Switch
                    value={moneySplitterOn}
                    onValueChange={setMoneySplitterOn}
                    trackColor={{ false: 'rgba(255,255,255,0.20)', true: 'rgba(255,255,255,0.32)' }}
                    thumbColor={moneySplitterOn ? COLORS.warning : '#fff'}
                  />
                </View>
              </View>

              <View style={styles.splitterHeaderCenter}>
                <View style={styles.splitterTotalCircle}>
                  <Text style={[styles.splitterTotalPct, totalSplitPct > 100 ? styles.splitterTotalPctBad : null]}>%{totalSplitPct}</Text>
                  <Text style={styles.splitterTotalHint}>toplam</Text>
                </View>
              </View>
            </View>

            <View style={styles.splitterRulesBlock}>
              <View style={styles.splitterRulesHeader}>
                <Text style={styles.splitterRulesTitle}>Dağılım Kuralları</Text>
              </View>

              {moneySplitterOn && splits.map((s) => (
                <View key={s.id} style={[styles.glassCard, styles.splitRuleCard]}>
                  <View style={styles.splitRuleTopRow}>
                    <View style={[styles.splitRuleIcon, { backgroundColor: s.color || COLORS.primary }]}>
                      <Ionicons name={s.icon || 'cash-outline'} size={18} color="#fff" />
                    </View>
                    <View style={styles.splitRuleNameWrap}>
                      <TextInput
                        style={styles.splitRuleName}
                        value={s.name}
                        onChangeText={(t) => updateSplitName(s.id, t)}
                        placeholder="Yeni"
                        placeholderTextColor={COLORS.textSecondary}
                      />
                    </View>
                    <Text style={styles.splitRulePct}>%{s.pct}</Text>
                    <TouchableOpacity
                      onPress={() => removeSplit(s.id)}
                      style={styles.splitRuleTrash}
                      disabled={splits.length <= 1}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={16} color={splits.length <= 1 ? COLORS.border : COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <SplitSlider value={s.pct} color={s.color} onChange={(v) => updateSplitPct(s.id, v)} />
                </View>
              ))}

              <TouchableOpacity style={[styles.glassCard, styles.splitAddCard]} onPress={addSplit} activeOpacity={0.9}>
                <Ionicons name="add" size={18} color={COLORS.primary} />
                <Text style={styles.splitAddCardText}>Yeni Dağılım Ekle</Text>
              </TouchableOpacity>

              {totalSplitPct > 100 && (
                <View style={styles.splitWarn}>
                  <Text style={styles.splitWarnText}>⚠️ Toplam %100’ü geçmemeli. Şu an %{totalSplitPct}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* summary içerik üstte tek blokta render ediliyor */}

<TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          await storage.removeItem('token');
          router.replace('/');
        }}
      >
        <Text style={styles.logoutText}>Çıkış yap</Text>
      </TouchableOpacity>
      </ScrollView>

      {/* New Goal Modal */}
      <Modal visible={newGoalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNewGoalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalCenter}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Yeni Hedef</Text>
                  <TouchableOpacity onPress={() => setNewGoalVisible(false)}>
                    <Ionicons name="close" size={24} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Hedef</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Örn: Yeni bilgisayar"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newGoalName}
                    onChangeText={setNewGoalName}
                  />
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Hedef tutar (Birikim)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0"
                    placeholderTextColor={COLORS.textSecondary}
                    value={newGoalTarget}
                    onChangeText={setNewGoalTarget}
                    keyboardType="decimal-pad"
                  />
                </View>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={async () => {
                    if (!newGoalName.trim()) return;
                    try {
                      await goalsApi.create({
                        name: newGoalName.trim(),
                        target_amount: newGoalTarget ? parseFloat(newGoalTarget.replace(',', '.')) : null,
                        type: 'savings',
                      });
                      setNewGoalVisible(false);
                      setNewGoalName('');
                      setNewGoalTarget('');
                      load();
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                >
                  <Text style={styles.modalSaveText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Bildirimler Modal */}
      <Modal visible={notifVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNotifVisible(false)}
        >
          <TouchableOpacity style={styles.notifModalContent} activeOpacity={1} onPress={() => {}}>
            <View style={styles.notifModalHeader}>
              <Text style={styles.notifModalTitle}>Bildirimler</Text>
              <TouchableOpacity onPress={() => setNotifVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.notifItem} onPress={() => setNotifVisible(false)}>
              <View style={styles.notifItemIcon}>
                <Ionicons name="cash-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.notifItemBody}>
                <Text style={styles.notifItemTitle}>Hoşgeldin Kampanyası</Text>
                <Text style={styles.notifItemText}>20.000 TL %0 faiz fırsatından yararlan. Kampanya detaylarına uygulama içinden ulaşabilirsin.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifItem} onPress={() => setNotifVisible(false)}>
              <View style={styles.notifItemIcon}>
                <Ionicons name="star-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={styles.notifItemBody}>
                <Text style={styles.notifItemTitle}>Nays Hakkında</Text>
                <Text style={styles.notifItemText}>Nays üyeliği ile Seviye 3'e geçebilir, 30 gün birikime dokunmama hedefine ulaşabilirsin. Profil sayfasından Nays'a katıl.</Text>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 120 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header (sticky style – light bg)
  header: {
    flexDirection: 'column',
    backgroundColor: '#0b1b3d',
    paddingHorizontal: SPACING.md,
    paddingTop: 48,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileBtn: { padding: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 12,
    height: 40,
    marginHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#fff',
    fontSize: 14,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 8 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.surface,
  },

  // Top Tabs (Özetim / Hedefler / Splitter)
  topTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255, 235, 179, 0.22)',
    borderRadius: RADIUS.xl,
  },
  topTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginHorizontal: 2,
    borderRadius: RADIUS.xl,
  },
  topTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#fff',
  },
  topTabIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 153, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  topTabLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(0, 153, 255, 0.85)' },
  topTabLabelActive: { color: '#fff' },

  // Balance Hero
  balanceSection: { padding: SPACING.md },
  balanceCard: {
    backgroundColor: '#0f172a',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  balanceGlow: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(0,51,153,0.2)',
  },
  balanceInner: { position: 'relative', zIndex: 1 },
  balanceLabel: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  balanceAmount: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 4, letterSpacing: -0.5 },
  progressRow: { marginTop: 14 },
  progressLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', letterSpacing: 1 },
  progressValue: { fontSize: 14, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
  detailsBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'flex-end',
  },
  detailsBtnSmall: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  detailsBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Quick Actions
  quickSection: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickBtn: { flex: 1, alignItems: 'center', gap: 8 },
  quickIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2f7',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },


  // Aylık Özet
  monthlySummaryWrap: { paddingHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm },
  monthlySummary: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
  },
  glassCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  monthlySummaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  monthlySummaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,51,153,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthlySummaryTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: -6 },
  summaryCard: { width: '48%', padding: 6, marginBottom: 12 },
  statCard: {
    padding: 16,
    borderRadius: RADIUS.lg,
  },
  statCardMuted: { backgroundColor: '#eef2f7' },
  statCardPrimarySoft: { backgroundColor: 'rgba(0,51,153,0.08)' },
  statCardDangerSoft: { backgroundColor: 'rgba(220, 38, 38, 0.08)' },
  summaryCardLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  summaryCardValue: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  summaryCardValuePrimary: { color: COLORS.primary },
  summaryCardValueDanger: { color: COLORS.error },

  // Campaign banner
  aiSection: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.lg },
  campaignCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },
  campaignIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#eef2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  campaignBody: { flex: 1 },
  campaignTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  campaignText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  campaignBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  campaignBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.success },

  // Goals (Aktif Hedefler tab)
  goalsSection: { paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md },
  goalsList: { marginTop: SPACING.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  sectionLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  goalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,51,153,0.06)',
  },
  goalCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  goalCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  goalSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  goalAmountWrap: { alignItems: 'flex-end' },
  goalAmount: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  goalBar: { borderRadius: RADIUS.full },

  // Recent Activity
  activitySection: { padding: SPACING.md, paddingTop: SPACING.lg },
  activityList: { gap: 12 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2f7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityBody: { flex: 1 },
  activityDesc: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  activityDate: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  activityAmount: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  activityAmountGreen: { color: COLORS.primary },
  emptyActivity: { padding: SPACING.lg, alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary },

  // Splitter tab
  splitterSection: { padding: SPACING.md, paddingTop: SPACING.lg },
  splitterHeaderCard: {
    backgroundColor: '#0b1b3d',
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  splitterHeaderOrn1: { position: 'absolute', top: -28, right: -28, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  splitterHeaderOrn2: { position: 'absolute', bottom: -22, left: -22, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)' },
  splitterHeaderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  splitterHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitterHeaderIconBox: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  splitterHeaderTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  splitterHeaderSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  splitterHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  splitterHeaderCenter: { alignItems: 'center', marginTop: 18, marginBottom: 2 },
  splitterTotalCircle: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  splitterTotalPct: { fontSize: 28, fontWeight: '900', color: '#fff' },
  splitterTotalPctBad: { color: '#fb7185' },
  splitterTotalHint: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  splitterRulesBlock: { marginTop: 14, gap: 12 },
  splitterRulesHeader: { paddingHorizontal: 2, paddingTop: 2 },
  splitterRulesTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  splitRuleCard: { padding: 14 },
  splitRuleTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  splitRuleIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  splitRuleNameWrap: { flex: 1, minWidth: 0 },
  splitRuleName: { fontSize: 14, fontWeight: '800', color: COLORS.text, paddingVertical: 0 },
  splitRulePct: { fontSize: 16, fontWeight: '900', color: COLORS.text },
  splitRuleTrash: { padding: 6 },

  splitSliderTrack: { height: 12, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'visible', justifyContent: 'center' },
  splitSliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999 },
  splitSliderThumb: { position: 'absolute', top: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 3, marginLeft: -12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },

  splitAddCard: { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  splitAddCardText: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  splitWarn: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  splitWarnText: { fontSize: 12, fontWeight: '700', color: COLORS.error },

  logoutBtn: { margin: SPACING.xl, alignItems: 'center' },
  logoutText: { color: COLORS.error, fontSize: 14 },

  // New Goal Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCenter: { justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalField: { marginBottom: SPACING.lg },
  modalLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalSaveText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Bildirimler modal
  notifModalContent: {
    alignSelf: 'center',
    width: '90%',
    maxWidth: 400,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  notifModalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  notifItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,51,153,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifItemBody: { flex: 1 },
  notifItemTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  notifItemText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 19 },
});
