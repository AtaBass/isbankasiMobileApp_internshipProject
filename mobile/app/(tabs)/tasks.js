import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { tasks as tasksApi, rewards as rewardsApi } from '../../lib/api';
import { getCurrentPasaportLevel, PASAPORT_LEVELS } from '../../lib/pasaportLevel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG_LIGHT = '#f0f4ff';
const BORDER_CARD = '#e5e7eb';
const TEXT_MAIN = '#101318';
const TEXT_MUTED = '#475569';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 16;
const CASHBACK_IMG = require('../../assets/cashback.png');
const MOVIE_IMG = require('../../assets/biletix.png');
const THEATRE_IMG = require('../../assets/tiyatro.png');
const CONCERT_LOGO = require('../../assets/biletinial.png');
const MAVI_LOGO = require('../../assets/mavi.png');

const MIGROS_LOGO = require('../../assets/migros.png');
const NAYS_LOGO = require('../../assets/nays.png');
const MAKSIMUM_GENC_LOGO = require('../../assets/maksimum-genc.png');

const DAYS_STREAK = [
  { day: 'Pzt', done: true },
  { day: 'Sal', done: true },
  { day: 'Çar', done: true },
  { day: 'Per', done: true, today: true },
  { day: 'Cum', done: false },
  { day: 'Cmt', done: false },
  { day: 'Paz', done: false },
];

const BASE_USER_POINTS = 1500;
const BASE_LEADERBOARD = [
  { name: 'Elif K.', points: 4200, avatar: 'E' },
  { name: 'Ahmet Y.', points: 3800, avatar: 'A' },
  { name: 'Sen', points: BASE_USER_POINTS, avatar: 'M', isUser: true },
  { name: 'Zeynep T.', points: 1350, avatar: 'Z' },
  { name: 'Burak S.', points: 1100, avatar: 'B' },
  { name: 'Selin A.', points: 980, avatar: 'S' },
  { name: 'Mert D.', points: 750, avatar: 'M' },
];

const DEMO_ACTIVE_TASKS = [
  {
    id: 'migros_500',
    title: "Migros'tan 500 TL'lik alışveriş yap",
    description: 'Bu hafta market alışverişini Migros’tan tamamla',
    points_reward: 30,
    icon: 'cart',
    actionLabel: 'Başla',
    color: '#f97316', // turuncu
    logo: MIGROS_LOGO,
  },
  {
    id: 'nays_account',
    title: 'Nays hesabı aç',
    description: 'Yeni Nays hesabını oluştur',
    points_reward: 60,
    icon: 'person-add',
    actionLabel: 'Başla',
    color: '#93c5fd', // açık mavi
    accent: '#f472b6', // pembe
    logo: NAYS_LOGO,
  },
  {
    id: 'levis_jeans',
    title: 'Maksimum Genç Kart edin',
    description: 'Maksimum Genç kart başvurunu tamamla',
    points_reward: 45,
    icon: 'shirt',
    actionLabel: 'Başla',
    color: '#ef4444', // kırmızı
    logo: MAKSIMUM_GENC_LOGO,
    iconBg: '#ffffff',
    logoLarge: true,
  },
];

// "Tümünü gör" modalında gösterilecek görevler (2. görsel)
const MODAL_TASKS = [
  { id: 'mini_savings', title: 'Haftalık Mini Birikim', description: '', points_reward: 10, icon: 'wallet', actionLabel: 'Başla' },
  { id: 'coffee_free', title: 'Kahvesiz Hafta', description: '', points_reward: 15, icon: 'cafe', actionLabel: 'Başla' },
  { id: 'steps_5k', title: 'Günlük 5K Adım', description: '', points_reward: 20, icon: 'walk', actionLabel: 'Başla' },
  { id: 'no_outside_food', title: 'Dışarıda Yemek Yok', description: '', points_reward: 25, icon: 'restaurant', actionLabel: 'Başla' },
];

function isDemoTaskId(id) {
  const s = String(id);
  return s.length > 0 && !/^\d+$/.test(s);
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [points, setPoints] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [redeemingId, setRedeemingId] = useState(null);
  const [protectedOn, setProtectedOn] = useState(true);
  const [showAllChallenges, setShowAllChallenges] = useState(false);
  const [showPasaportModal, setShowPasaportModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [redeemedRewardIds, setRedeemedRewardIds] = useState([]);
  const [completedTaskIds, setCompletedTaskIds] = useState([]);

  const load = async () => {
    try {
      const [t, r, p] = await Promise.all([
        tasksApi.list().catch(() => []),
        rewardsApi.list().catch(() => []),
        rewardsApi.myPoints().catch(() => null),
      ]);
      setTasks(t);
      setRewards(r);
      setPoints(p);
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completeTask = async (task) => {
    const taskId = task?.id ?? task;
    const pointsReward = typeof task === 'object' && task != null ? (task.points_reward ?? 0) : 0;
    setCompletingId(taskId);
    try {
      if (isDemoTaskId(taskId)) {
        setCompletedTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
        Alert.alert('Tamamlandı!', `Görev tamamlandı. +${pointsReward} puan bakiyene eklendi.`);
      } else {
        await tasksApi.complete(taskId);
        load();
        Alert.alert('Tamamlandı!', `Görev tamamlandı. +${pointsReward} puan bakiyene eklendi.`);
      }
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Bir hata oluştu.');
    } finally {
      setCompletingId(null);
    }
  };

  const rewardItems = [
    {
      id: '1',
      name: '100₺ Cashback',
      desc: 'Cüzdanına anında bakiye kredisi',
      points_cost: 800,
      useIcon: true, // para simgesi göster
      popular: true,
    },
    {
      id: '2',
      name: "Mavi'den 200 TL Hediye Kuponu",
      desc: "Mavi mağazalarında 200 TL'lik kupon fırsatı",
      points_cost: 500,
      image: MAVI_LOGO,
      imageIsLogo: true, // logo olarak ortala
      logoBg: '#1f4f8d',
      popular: false,
    },
  ];
  const wideReward = {
    id: '3',
    name: 'Tiyatro Bileti',
    desc: 'İstediğin oyun, istediğin zaman',
    points_cost: 1200,
    image: THEATRE_IMG,
    imageIsLogo: true,
    logoBg: '#0b74ff',
  };
  const concertReward = {
    id: '4',
    name: 'Konser Bileti',
    desc: 'Konser biletini hemen al',
    points_cost: 1400,
    image: MOVIE_IMG,
    imageIsLogo: true,
    logoBg: '#16a34a',
  };
  const allRewardsList = [...rewardItems, wideReward, concertReward];

  const spentOnRedeemed = allRewardsList
    .filter((r) => redeemedRewardIds.includes(r.id))
    .reduce((sum, r) => sum + (Number(r.points_cost) || 0), 0);
  const pointsFromCompletedTasks = DEMO_ACTIVE_TASKS.filter((t) => completedTaskIds.includes(t.id))
    .reduce((sum, t) => sum + (Number(t.points_reward) || 0), 0);
  // Kullanılabilir puan (ödül harcayınca düşer)
  const totalPts = BASE_USER_POINTS + pointsFromCompletedTasks - spentOnRedeemed;
  // Liderlik puanı (ödül harcayınca değişmez)
  const leaderboardUserPts = BASE_USER_POINTS + pointsFromCompletedTasks;
  const leaderboardData = BASE_LEADERBOARD
    .map((u) => (u.isUser ? { ...u, points: leaderboardUserPts } : u))
    .slice()
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  const redeemReward = async (reward) => {
    const cost = Number(reward.points_cost) || 0;
    if (totalPts < cost) {
      Alert.alert('Yetersiz puan', 'Bu ödülü kullanmak için daha fazla puan gerekli.');
      return;
    }
    setRedeemingId(reward.id);
    try {
      await rewardsApi.redeem(reward.id);
      setRedeemedRewardIds((prev) => (prev.includes(reward.id) ? prev : [...prev, reward.id]));
      load();
      Alert.alert('Kullanıldı!', `${reward.name} ödüllerine eklendi.`);
    } catch (e) {
      const isInsufficientPoints = (e?.message || '').toLowerCase().includes('yetersiz') || (e?.message || '').toLowerCase().includes('puan');
      if (isInsufficientPoints && totalPts >= cost) {
        setRedeemedRewardIds((prev) => (prev.includes(reward.id) ? prev : [...prev, reward.id]));
        load();
        Alert.alert('Kullanıldı!', `${reward.name} ödüllerine eklendi.`);
      } else {
        Alert.alert('Hata', e?.message || 'Bir hata oluştu.');
      }
    } finally {
      setRedeemingId(null);
    }
  };

  const missionList = DEMO_ACTIVE_TASKS.filter((t) => !completedTaskIds.includes(t.id));
  const allChallengesList = MODAL_TASKS;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={styles.headerTitle}>Görevler & Ödüller</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.pointsPill}
              onPress={() => setShowLeaderboard(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="trophy" size={12} color="#fff" />
              <Text style={styles.pointsPillText}>{totalPts.toLocaleString('tr-TR')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 7-Day Streak */}
        <View style={styles.section}>
          <View style={styles.glassCard}>
            <View style={styles.streakNavy}>
              <View style={styles.streakHeader}>
                <View style={styles.streakTitleRow}>
                  <Ionicons name="flash" size={16} color="#93c5fd" />
                  <Text style={styles.streakTitle}>7 Günlük Seri</Text>
                </View>
                <View style={styles.protectedPill}>
                  <Ionicons name="shield-checkmark" size={12} color="#93c5fd" />
                </View>
              </View>
            </View>
            <View style={styles.daysRowWrap}>
              {DAYS_STREAK.map((d, i) => (
                <View key={d.day} style={styles.dayBlock}>
                  <View style={[
                    styles.dayCircle,
                    d.done && !d.today && styles.dayCircleDone,
                    d.today && styles.dayCircleToday,
                    !d.done && styles.dayCircleFuture,
                  ]}>
                    {d.done ? (
                      <Ionicons name="checkmark" size={16} color={d.today ? COLORS.primary : '#fff'} />
                    ) : (
                      <Text style={styles.dayCircleNum}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.dayLabel, d.today && styles.dayLabelToday]}>{d.day}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Aktif Görevler */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktif Görevler</Text>
            <TouchableOpacity onPress={() => setShowAllChallenges(true)}>
              <Text style={styles.viewAll}>Tümünü gör</Text>
            </TouchableOpacity>
          </View>
          {missionList.slice(0, 3).map((task, idx) => (
            <View key={task.id} style={[styles.glassCard, styles.missionCard]}>
              <View
                style={[
                  styles.missionIconWrap,
                  {
                    backgroundColor: task.iconBg || task.color || COLORS.primary,
                    borderWidth: task.accent ? 2 : 0,
                    borderColor: task.accent ? task.accent : 'transparent',
                  },
                ]}
              >
                {task.logo ? (
                  <Image source={task.logo} style={[styles.missionLogo, task.logoLarge && styles.missionLogoLarge]} />
                ) : (
                  <Ionicons name={task.icon || 'flag'} size={18} color="#fff" />
                )}
              </View>
              <View style={styles.missionBody}>
                <Text style={styles.missionTitle}>{task.title}</Text>
                <Text style={styles.missionDesc}>{task.description}</Text>
              </View>
              <View style={styles.missionRight}>
                <Text style={styles.missionPts}>+{task.points_reward} puan</Text>
                <TouchableOpacity
                  style={styles.missionBtn}
                  onPress={() => completeTask(task)}
                  disabled={completingId === task.id}
                >
                  {completingId === task.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.missionBtnText}>{task.actionLabel || 'Başla'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Ödül Mağazası */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ödül Mağazası</Text>
          <View style={styles.rewardsGrid}>
            {rewardItems.map((r) => (
              <View key={r.id} style={styles.rewardCard}>
                <View style={styles.rewardCardTop}>
                  {r.useIcon ? (
                    <View style={styles.rewardIconHero}>
                      <View style={styles.rewardIconCircle}>
                        <Ionicons name="cash-outline" size={36} color={COLORS.primary} />
                      </View>
                      {r.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>POPÜLER</Text>
                        </View>
                      )}
                    </View>
                  ) : r.imageIsLogo ? (
                    <View style={[styles.rewardLogoHero, { backgroundColor: r.logoBg || '#0b74ff' }]}>
                      <Image source={r.image} style={styles.rewardLogoImage} />
                      {r.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>POPÜLER</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <ImageBackground
                      source={typeof r.image === 'string' ? { uri: r.image } : r.image}
                      style={styles.rewardImage}
                      resizeMode="cover"
                    >
                      <View style={styles.rewardImageOverlay} />
                      {r.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>POPÜLER</Text>
                        </View>
                      )}
                    </ImageBackground>
                  )}
                </View>
                <View style={styles.rewardCardBody}>
                  <Text style={styles.rewardName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.rewardDesc} numberOfLines={2}>{r.desc}</Text>
                  <View style={styles.rewardFooter}>
                    <Text style={styles.rewardPts}>{r.points_cost} puan</Text>
                    {redeemedRewardIds.includes(r.id) ? (
                      <View style={styles.redeemedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                        <Text style={styles.redeemedBadgeText}>Ödül Alındı</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.cartBtn}
                        onPress={() => redeemReward(r)}
                        disabled={redeemingId === r.id}
                      >
                        <Ionicons name="cart" size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.rewardCardWide}>
            {wideReward.imageIsLogo ? (
              <View style={[styles.rewardWideLogoLeft, { backgroundColor: wideReward.logoBg || '#0b74ff' }]}>
                <Image source={wideReward.image} style={styles.rewardWideLogoImage} />
              </View>
            ) : (
              <ImageBackground
                source={typeof wideReward.image === 'string' ? { uri: wideReward.image } : wideReward.image}
                style={styles.rewardWideLeft}
                resizeMode="cover"
              >
                <View style={styles.rewardWideLeftOverlay} />
              </ImageBackground>
            )}
            <View style={styles.rewardWideRight}>
              <Text style={styles.rewardNameWide}>{wideReward.name}</Text>
              <Text style={styles.rewardDescWide}>{wideReward.desc}</Text>
              <View style={styles.rewardFooterWide}>
                <Text style={styles.rewardPts}>{wideReward.points_cost} puan</Text>
                {redeemedRewardIds.includes(wideReward.id) ? (
                  <View style={styles.redeemedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={styles.redeemedBadgeText}>Ödül Alındı</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.cartBtn}
                    onPress={() => redeemReward(wideReward)}
                    disabled={redeemingId === wideReward.id}
                  >
                    <Ionicons name="cart" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={[styles.rewardCardWide, styles.rewardCardWideGap]}>
            {concertReward.imageIsLogo ? (
              <View style={[styles.rewardWideLogoLeft, { backgroundColor: concertReward.logoBg || '#facc15' }]}>
                <Image source={concertReward.image} style={styles.rewardWideLogoImage} />
              </View>
            ) : (
              <ImageBackground
                source={typeof concertReward.image === 'string' ? { uri: concertReward.image } : concertReward.image}
                style={styles.rewardWideLeft}
                resizeMode="cover"
              >
                <View style={styles.rewardWideLeftOverlay} />
              </ImageBackground>
            )}
            <View style={styles.rewardWideRight}>
              <Text style={styles.rewardNameWide}>{concertReward.name}</Text>
              <Text style={styles.rewardDescWide}>{concertReward.desc}</Text>
              <View style={styles.rewardFooterWide}>
                <Text style={styles.rewardPts}>{concertReward.points_cost} puan</Text>
                {redeemedRewardIds.includes(concertReward.id) ? (
                  <View style={styles.redeemedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                    <Text style={styles.redeemedBadgeText}>Ödül Alındı</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.cartBtn}
                    onPress={() => redeemReward(concertReward)}
                    disabled={redeemingId === concertReward.id}
                  >
                    <Ionicons name="cart" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Tüm challenge'lar modal */}
      <Modal
        visible={showAllChallenges}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAllChallenges(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAllChallenges(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tüm Görevler</Text>
              <TouchableOpacity onPress={() => setShowAllChallenges(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={28} color={TEXT_MAIN} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {allChallengesList.map((task) => {
                const isCompleted = completedTaskIds.includes(task.id) || (task.completed === true);
                return (
                  <View key={task.id} style={styles.missionCard}>
                    <View style={styles.missionIconWrap}>
                      <Ionicons name={task.icon || 'flag'} size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.missionBody}>
                      <Text style={styles.missionTitle}>{task.title}</Text>
                      <Text style={styles.missionDesc}>{task.description}</Text>
                    </View>
                    <View style={styles.missionRight}>
                      <Text style={styles.missionPts}>+{task.points_reward} puan</Text>
                      {isCompleted ? (
                        <View style={styles.redeemedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                          <Text style={styles.redeemedBadgeText}>Tamamlandı</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.missionBtn}
                          onPress={() => { setShowAllChallenges(false); completeTask(task); }}
                          disabled={completingId === task.id}
                        >
                          {completingId === task.id ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                          ) : (
                            <Text style={styles.missionBtnText}>{task.actionLabel || 'Başla'}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Finansal Pasaport modal - seviye kutusuna tıklanınca */}
      <Modal
        visible={showPasaportModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPasaportModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPasaportModal(false)}>
          <Pressable style={styles.pasaportModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pasaportModalHeader}>
              <View style={styles.pasaportTitleRow}>
                <Ionicons name="trophy" size={22} color={COLORS.primary} />
                <Text style={styles.pasaportModalTitle}>Finansal Pasaport</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPasaportModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={28} color={TEXT_MAIN} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pasaportModalScroll} contentContainerStyle={styles.pasaportModalScrollContent} showsVerticalScrollIndicator={false}>
              {PASAPORT_LEVELS.map((item) => (
                <View key={item.level} style={styles.pasaportRow}>
                  <View style={styles.pasaportLeft}>
                    <Text style={styles.pasaportLevelNum}>{item.level}</Text>
                    <View>
                      <Text style={styles.pasaportLevelTitle}>{item.title}</Text>
                      <Text style={styles.pasaportLevelDesc}>{item.desc}</Text>
                    </View>
                  </View>
                  {item.done ? (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                  ) : (
                    <View style={styles.pasaportCircle} />
                  )}
                </View>
              ))}
              <View style={styles.pasaportRewardsBox}>
                <View style={styles.pasaportRewardsTitleRow}>
                  <Ionicons name="gift" size={18} color={COLORS.primary} />
                  <Text style={styles.pasaportRewardsTitle}>Seviye Ödülleri</Text>
                </View>
                <Text style={styles.pasaportRewardsDesc}>
                  Seviye arttıkça cashback oranın artar, daha iyi kampanyalar açılır!
                </Text>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Liderlik Tablosu modal */}
      <Modal visible={showLeaderboard} animationType="slide" transparent onRequestClose={() => setShowLeaderboard(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLeaderboard(false)}>
          <Pressable style={styles.leaderboardSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.leaderboardHandle} />
            <View style={styles.leaderboardHeader}>
              <View>
                <Text style={styles.leaderboardTitle}>Liderlik Tablosu</Text>
                <Text style={styles.leaderboardSubtitle}>Bu haftanın en aktif kullanıcıları</Text>
              </View>
              <TouchableOpacity style={styles.leaderboardClose} onPress={() => setShowLeaderboard(false)}>
                <Ionicons name="close" size={16} color={TEXT_MAIN} />
              </TouchableOpacity>
            </View>
            <View style={styles.podiumRow}>
              <View style={styles.podiumItem}>
                <View style={[styles.podiumAvatar, styles.podiumAvatar2]}>
                  <Text style={styles.podiumAvatarText}>{leaderboardData[1].avatar}</Text>
                </View>
                <Text style={styles.podiumName}>{leaderboardData[1].name}</Text>
                <Text style={styles.podiumPts}>{leaderboardData[1].points.toLocaleString('tr-TR')}</Text>
                <View style={styles.podiumBlock2}><Text style={styles.podiumNum}>2</Text></View>
              </View>
              <View style={[styles.podiumItem, styles.podiumItem1]}>
                <Ionicons name="trophy" size={20} color="#e2e8f0" style={{ marginBottom: 4 }} />
                <View style={[styles.podiumAvatar, styles.podiumAvatar1]}>
                  <Text style={styles.podiumAvatarText}>{leaderboardData[0].avatar}</Text>
                </View>
                <Text style={[styles.podiumName, styles.podiumName1]}>{leaderboardData[0].name}</Text>
                <Text style={styles.podiumPts1}>{leaderboardData[0].points.toLocaleString('tr-TR')}</Text>
                <View style={styles.podiumBlock1}><Text style={styles.podiumNum1}>1</Text></View>
              </View>
              <View style={styles.podiumItem}>
                <View style={[styles.podiumAvatar, styles.podiumAvatar3]}>
                  <Text style={styles.podiumAvatarText}>{leaderboardData[2].avatar}</Text>
                </View>
                <Text style={styles.podiumName}>{leaderboardData[2].name}</Text>
                <Text style={styles.podiumPts}>{leaderboardData[2].points.toLocaleString('tr-TR')}</Text>
                <View style={styles.podiumBlock3}><Text style={styles.podiumNum}>3</Text></View>
              </View>
            </View>
            <ScrollView style={styles.leaderboardList} contentContainerStyle={styles.leaderboardListContent}>
              {leaderboardData.slice(3).map((user, i) => (
                <View key={user.name} style={[styles.leaderboardRow, user.isUser && styles.leaderboardRowUser]}>
                  <Text style={styles.leaderboardRank}>{i + 4}</Text>
                  <View style={[styles.leaderboardAvatar, user.isUser && styles.leaderboardAvatarUser]}>
                    <Text style={[styles.leaderboardAvatarText, user.isUser && styles.leaderboardAvatarTextUser]}>{user.avatar}</Text>
                  </View>
                  <Text style={[styles.leaderboardUserName, user.isUser && styles.leaderboardUserNameHighlight]}>{user.name}</Text>
                  <Text style={styles.leaderboardUserPts}>{user.points.toLocaleString('tr-TR')}</Text>
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: BG_LIGHT },
  container: { flex: 1 },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 18,
    paddingTop: 20,
    gap: 16,
    backgroundColor: '#0b1b3d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: BORDER_CARD,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelBadgeText: { fontSize: 10, color: TEXT_MUTED },
  levelBadgeNum: { fontSize: 10, fontWeight: '700', color: TEXT_MAIN },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  pointsPillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  glassCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_CARD,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TEXT_MAIN },
  modalCloseBtn: { padding: 4 },
  modalScroll: { maxHeight: 400 },
  modalScrollContent: { padding: CARD_PADDING, paddingBottom: 32 },
  pasaportModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    maxHeight: '85%',
  },
  pasaportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CARD_PADDING,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_CARD,
  },
  pasaportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pasaportModalTitle: { fontSize: 18, fontWeight: '700', color: TEXT_MAIN },
  pasaportModalScroll: { maxHeight: 420 },
  pasaportModalScrollContent: { padding: CARD_PADDING, paddingBottom: 32 },
  pasaportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER_CARD,
  },
  pasaportLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pasaportLevelNum: { fontSize: 16, fontWeight: '700', color: COLORS.primary, minWidth: 24, textAlign: 'center' },
  pasaportLevelTitle: { fontSize: 15, fontWeight: '600', color: TEXT_MAIN },
  pasaportLevelDesc: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  pasaportCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: BORDER_CARD },
  pasaportRewardsBox: {
    backgroundColor: 'rgba(0,51,153,0.06)',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,51,153,0.1)',
  },
  pasaportRewardsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  pasaportRewardsTitle: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  pasaportRewardsDesc: { fontSize: 13, color: TEXT_MUTED, lineHeight: 20 },
  section: { paddingHorizontal: CARD_PADDING, marginTop: 8, marginBottom: 24 },
  streakNavy: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streakTitle: { fontSize: 16, fontWeight: '700', color: '#e2e8f0' },
  protectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  daysRowWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dayBlock: { alignItems: 'center', flex: 1 },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCircleDone: { backgroundColor: COLORS.primary },
  dayCircleToday: {
    backgroundColor: '#93c5fd',
    shadowColor: '#93c5fd',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  dayCircleFuture: {},
  dayCircleNum: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED },
  dayLabel: { fontSize: 10, fontWeight: '600', color: TEXT_MUTED, marginTop: 6 },
  dayLabelToday: { color: COLORS.primary, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: TEXT_MAIN, marginBottom: 12 },
  viewAll: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  missionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  missionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,51,153,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  missionLogo: { width: 34, height: 34, resizeMode: 'contain' },
  missionLogoLarge: { width: 42, height: 42 },
  missionBody: { flex: 1, marginLeft: 12 },
  missionTitle: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  missionDesc: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  missionRight: { alignItems: 'flex-end' },
  missionPts: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  missionBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 64,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  missionBtnText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  rewardsGrid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  rewardCard: {
    flex: 1,
    maxWidth: (SCREEN_WIDTH - CARD_PADDING * 2 - 16) / 2,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BORDER_CARD,
    overflow: 'hidden',
  },
  rewardCardTop: { height: 112, backgroundColor: 'rgba(0,51,153,0.2)' },
  rewardImage: { flex: 1 },
  rewardImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,51,153,0.2)' },
  rewardIconHero: { flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  rewardIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,51,153,0.10)', justifyContent: 'center', alignItems: 'center' },
  rewardLogoHero: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rewardLogoImage: { width: 120, height: 56, resizeMode: 'contain' },
  popularBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularBadgeText: { fontSize: 10, fontWeight: '700', color: TEXT_MAIN },
  rewardCardBody: { padding: 12 },
  rewardName: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  rewardDesc: { fontSize: 10, color: TEXT_MUTED, marginTop: 4 },
  rewardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  rewardPts: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  cartBtn: {
    backgroundColor: TEXT_MAIN,
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redeemedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  redeemedBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.success },
  rewardCardWide: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BORDER_CARD,
    overflow: 'hidden',
  },
  rewardCardWideGap: { marginTop: 14 },
  rewardWideLeft: { width: '33%', minHeight: 96 },
  rewardWideLeftOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,51,153,0.3)' },
  rewardWideLogoLeft: { width: '33%', minHeight: 96, justifyContent: 'center', alignItems: 'center' },
  rewardWideLogoImage: { width: 120, height: 48, resizeMode: 'contain' },
  rewardWideRight: { flex: 1, padding: 12, justifyContent: 'center' },
  rewardNameWide: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  rewardDescWide: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },
  rewardFooterWide: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
  },
  redeemBtnText: { fontSize: 12, fontWeight: '700', color: TEXT_MAIN },

  // Leaderboard modal
  leaderboardSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  leaderboardHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER_CARD,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  leaderboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 16,
  },
  leaderboardTitle: { fontSize: 18, fontWeight: '800', color: TEXT_MAIN },
  leaderboardSubtitle: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  leaderboardClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 16,
  },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumItem1: { marginTop: -12 },
  podiumAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  podiumAvatar1: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
  },
  podiumAvatar2: { backgroundColor: '#64748b' },
  podiumAvatar3: { backgroundColor: COLORS.primaryLight },
  podiumAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  podiumName: { fontSize: 11, fontWeight: '600', color: TEXT_MAIN },
  podiumName1: { fontWeight: '700' },
  podiumPts: { fontSize: 10, color: TEXT_MUTED, marginTop: 2 },
  podiumPts1: { fontSize: 10, fontWeight: '600', color: COLORS.primary, marginTop: 2 },
  podiumBlock2: {
    width: 64,
    height: 56,
    backgroundColor: '#e0e7ff',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumBlock1: {
    width: 64,
    height: 72,
    backgroundColor: 'rgba(0,51,153,0.1)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumBlock3: {
    width: 64,
    height: 40,
    backgroundColor: '#dbeafe',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumNum: { fontSize: 18, fontWeight: '800', color: TEXT_MUTED },
  podiumNum1: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  // Show ranks 4-7 initially, scroll for more
  leaderboardList: { maxHeight: 260 },
  leaderboardListContent: { paddingHorizontal: CARD_PADDING, paddingBottom: 24 },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  leaderboardRowUser: { backgroundColor: 'rgba(0,51,153,0.06)', borderColor: 'rgba(0,51,153,0.2)' },
  leaderboardRank: { fontSize: 14, fontWeight: '700', color: TEXT_MUTED, width: 24, textAlign: 'center' },
  leaderboardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  leaderboardAvatarUser: { backgroundColor: COLORS.primary },
  leaderboardAvatarText: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED },
  leaderboardAvatarTextUser: { color: '#fff' },
  leaderboardUserName: { flex: 1, marginLeft: 12, fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  leaderboardUserNameHighlight: { color: COLORS.primary },
  leaderboardUserPts: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
});
