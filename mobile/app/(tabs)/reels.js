import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS } from '../../constants/theme';
import { reels as reelsApi, rewards as rewardsApi } from '../../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REEL_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCt8NYkfnl2XEqB1wisQc0EF1T4PohbXofU1zfwIoJuPb7WAf53F7F87Ldixnb0ETYlvHi2yg407INtoB-LxQ6ImYvG-Xa-fpVKSMOV-BNkk89kKvE0J5N_fdkTHhpKn1Mn9ft51or48fOuiS8Z5bnhcRYLIvortvMnPRc5yKlQzaELr13ngFL4PfkFQs1ymLJx_rWhXSL1Bq0Z31WO5r4vEC9IgoroHemmefNNoqgEOsZiUduOXRZMA3oa5D4qcUj8x1PPwIyYxm5-';
const CREATOR_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1-DEG1XpJ-O59KQRBzReTZbcMFgN0XprUnmtx1s1bt9lak2gDPXAZ8JSdyvufPhAsSTkf5F0DFmEoSwEva38mfHQDDWz3Br4tYJNPhbF39JJQ5zdbp-uj2MaH5V-r875b6BkYkKD_qKn25A3msdb8Xl2WcsOtcPLuT-reyb0d1MWLdXwqbBHyWw4iAs3P9gCHZFhVelQFk0Bi8WzyOgCYnrZffJ3OP5MYwu3LZw9fEPsdhwTG9UtqSpiDxaBMmJeSQh_M81mK07x3';

export default function ReelsScreen() {
  const [reels, setReels] = useState([]);
  const [points, setPoints] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Promise.all([
      reelsApi.list().catch(() => []),
      rewardsApi.myPoints().catch(() => null),
    ]).then(([r, p]) => {
      setReels(r);
      setPoints(p);
    });
  }, []);

  const currentReel = reels[0] || {
    title: 'What is Compound Interest?',
    description: 'Learn how your money grows exponentially over time and why starting early is the key to wealth... #finance #learning',
    points_reward: 50,
    duration_seconds: 143,
  };
  const totalPts = points?.available_points ?? 1250;
  const progressPct = 65;

  return (
    <View style={styles.container}>
      {/* Video background layer */}
      <View style={styles.videoWrap}>
        <ImageBackground
          source={{ uri: REEL_IMAGE }}
          style={styles.videoBg}
          resizeMode="cover"
        />
        <View style={styles.gradientTop} />
        <View style={styles.gradientBottom} />
      </View>

      {/* Top header: For You / Following + search + points pill */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.tabsRow}>
          <TouchableOpacity style={styles.tabActive}>
            <Text style={styles.tabActiveText}>For You</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.topRightRow}>
          <View style={styles.pointsPill}>
            <Ionicons name="trophy" size={18} color="#fff" />
            <Text style={styles.pointsPillText}>+{currentReel.points_reward ?? 50} PTS</Text>
          </View>
        </View>
      </View>

      {/* Middle: tap to pause / play */}
      <View style={styles.middleArea}>
        <View style={styles.playBtnCircle}>
          <Ionicons name="play" size={56} color="rgba(255,255,255,0.4)" />
        </View>
      </View>

      {/* Right sidebar: avatar + follow, like, comment, share, bookmark */}
      <View style={styles.sidebar}>
        <View style={styles.creatorWrap}>
          <Image source={{ uri: CREATOR_AVATAR }} style={styles.creatorAvatar} />
          <View style={styles.followBadge}>
            <Ionicons name="add" size={14} color="#fff" />
          </View>
        </View>
        <View style={styles.sideItem}>
          <TouchableOpacity>
            <Ionicons name="heart" size={32} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.sideCount}>12.5k</Text>
        </View>
        <View style={styles.sideItem}>
          <TouchableOpacity>
            <Ionicons name="chatbubble" size={32} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.sideCount}>856</Text>
        </View>
        <View style={styles.sideItem}>
          <TouchableOpacity>
            <Ionicons name="bookmark" size={32} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.sideCount}>Save</Text>
        </View>
      </View>

      {/* Bottom content */}
      <View style={styles.bottomOverlay}>
        <View style={styles.bottomContent}>
          <Text style={styles.reelTitle} numberOfLines={1}>{currentReel.title}</Text>
          <Text style={styles.reelDesc} numberOfLines={2}>{currentReel.description}</Text>
          <View style={styles.audioRow}>
            <Ionicons name="musical-notes" size={14} color={COLORS.primary} />
            <Text style={styles.audioText} numberOfLines={1}>
              Original Sound - EduFinance Academy
            </Text>
          </View>
        </View>
        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  videoWrap: { ...StyleSheet.absoluteFillObject },
  videoBg: { flex: 1 },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 4,
  },
  tabActiveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pointsPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  middleArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  playBtnCircle: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 16,
    borderRadius: 9999,
  },
  sidebar: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    zIndex: 10,
    alignItems: 'center',
    gap: 24,
  },
  creatorWrap: { position: 'relative' },
  creatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#94a3b8',
  },
  followBadge: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideItem: { alignItems: 'center', gap: 2 },
  sideCount: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 88,
    paddingTop: 12,
  },
  bottomContent: { maxWidth: '80%' },
  reelTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  reelDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  audioText: { color: COLORS.primary, fontSize: 12, fontWeight: '500', flex: 1 },
  progressWrap: {
    marginTop: 8,
    paddingVertical: 8,
  },
  progressTrack: {
    height: 4,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
});
