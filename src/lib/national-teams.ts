/**
 * Fan Pulse — National Teams registry for World Cup 2026
 * 48 teams in the expanded 2026 format across 12 groups
 */

export type NationalTeam = {
  id: string
  name: string
  nameAr: string
  code: string
  flag: string
  group: string
  fifaRank: number
  primaryColor: string
  region: string
}

export const NATIONAL_TEAMS: NationalTeam[] = [
  // ── Group A ──
  { id: 'usa', name: 'United States', nameAr: 'الولايات المتحدة', code: 'USA', flag: '🇺🇸', group: 'A', fifaRank: 13, primaryColor: '#3C3B6E', region: 'CONCACAF' },
  { id: 'mexico', name: 'Mexico', nameAr: 'المكسيك', code: 'MEX', flag: '🇲🇽', group: 'A', fifaRank: 15, primaryColor: '#006341', region: 'CONCACAF' },
  { id: 'canada', name: 'Canada', nameAr: 'كندا', code: 'CAN', flag: '🇨🇦', group: 'A', fifaRank: 47, primaryColor: '#FF0000', region: 'CONCACAF' },
  { id: 'new-zealand', name: 'New Zealand', nameAr: 'نيوزيلندا', code: 'NZL', flag: '🇳🇿', group: 'A', fifaRank: 98, primaryColor: '#000000', region: 'OFC' },
  // ── Group B ──
  { id: 'argentina', name: 'Argentina', nameAr: 'الأرجنتين', code: 'ARG', flag: '🇦🇷', group: 'B', fifaRank: 1, primaryColor: '#75AADB', region: 'CONMEBOL' },
  { id: 'ecuador', name: 'Ecuador', nameAr: 'الإكوادور', code: 'ECU', flag: '🇪🇨', group: 'B', fifaRank: 35, primaryColor: '#FFD100', region: 'CONMEBOL' },
  { id: 'ukraine', name: 'Ukraine', nameAr: 'أوكرانيا', code: 'UKR', flag: '🇺🇦', group: 'B', fifaRank: 24, primaryColor: '#005BBB', region: 'UEFA' },
  { id: 'tunisia', name: 'Tunisia', nameAr: 'تونس', code: 'TUN', flag: '🇹🇳', group: 'B', fifaRank: 28, primaryColor: '#E70013', region: 'CAF' },
  // ── Group C ──
  { id: 'france', name: 'France', nameAr: 'فرنسا', code: 'FRA', flag: '🇫🇷', group: 'C', fifaRank: 2, primaryColor: '#002395', region: 'UEFA' },
  { id: 'colombia', name: 'Colombia', nameAr: 'كولومبيا', code: 'COL', flag: '🇨🇴', group: 'C', fifaRank: 12, primaryColor: '#FCD116', region: 'CONMEBOL' },
  { id: 'turkey', name: 'Turkey', nameAr: 'تركيا', code: 'TUR', flag: '🇹🇷', group: 'C', fifaRank: 38, primaryColor: '#E30A17', region: 'UEFA' },
  { id: 'cote-ivoire', name: "Côte d'Ivoire", nameAr: "كوت ديفوار", code: 'CIV', flag: '🇨🇮', group: 'C', fifaRank: 40, primaryColor: '#F77F00', region: 'CAF' },
  // ── Group D ──
  { id: 'brazil', name: 'Brazil', nameAr: 'البرازيل', code: 'BRA', flag: '🇧🇷', group: 'D', fifaRank: 5, primaryColor: '#009739', region: 'CONMEBOL' },
  { id: 'england', name: 'England', nameAr: 'إنجلترا', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'D', fifaRank: 4, primaryColor: '#FFFFFF', region: 'UEFA' },
  { id: 'jordan', name: 'Jordan', nameAr: 'الأردن', code: 'JOR', flag: '🇯🇴', group: 'D', fifaRank: 71, primaryColor: '#CE1126', region: 'AFC' },
  { id: 'paraguay', name: 'Paraguay', nameAr: 'باراغواي', code: 'PAR', flag: '🇵🇾', group: 'D', fifaRank: 55, primaryColor: '#D52B1E', region: 'CONMEBOL' },
  // ── Group E ──
  { id: 'germany', name: 'Germany', nameAr: 'ألمانيا', code: 'GER', flag: '🇩🇪', group: 'E', fifaRank: 3, primaryColor: '#000000', region: 'UEFA' },
  { id: 'south-korea', name: 'South Korea', nameAr: 'كوريا الجنوبية', code: 'KOR', flag: '🇰🇷', group: 'E', fifaRank: 23, primaryColor: '#CD2E3A', region: 'AFC' },
  { id: 'scotland', name: 'Scotland', nameAr: 'اسكتلندا', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'E', fifaRank: 39, primaryColor: '#003078', region: 'UEFA' },
  { id: 'uzbekistan', name: 'Uzbekistan', nameAr: 'أوزبكستان', code: 'UZB', flag: '🇺🇿', group: 'E', fifaRank: 58, primaryColor: '#1EB53A', region: 'AFC' },
  // ── Group F ──
  { id: 'spain', name: 'Spain', nameAr: 'إسبانيا', code: 'ESP', flag: '🇪🇸', group: 'F', fifaRank: 8, primaryColor: '#C60B1E', region: 'UEFA' },
  { id: 'portugal', name: 'Portugal', nameAr: 'البرتغال', code: 'POR', flag: '🇵🇹', group: 'F', fifaRank: 6, primaryColor: '#006600', region: 'UEFA' },
  { id: 'morocco', name: 'Morocco', nameAr: 'المغرب', code: 'MAR', flag: '🇲🇦', group: 'F', fifaRank: 14, primaryColor: '#C1272D', region: 'CAF' },
  { id: 'indonesia', name: 'Indonesia', nameAr: 'إندونيسيا', code: 'IDN', flag: '🇮🇩', group: 'F', fifaRank: 127, primaryColor: '#FF0000', region: 'AFC' },
  // ── Group G ──
  { id: 'italy', name: 'Italy', nameAr: 'إيطاليا', code: 'ITA', flag: '🇮🇹', group: 'G', fifaRank: 9, primaryColor: '#008C45', region: 'UEFA' },
  { id: 'netherlands', name: 'Netherlands', nameAr: 'هولندا', code: 'NED', flag: '🇳🇱', group: 'G', fifaRank: 7, primaryColor: '#FF6600', region: 'UEFA' },
  { id: 'australia', name: 'Australia', nameAr: 'أستراليا', code: 'AUS', flag: '🇦🇺', group: 'G', fifaRank: 25, primaryColor: '#FFD700', region: 'AFC' },
  { id: 'nigeria', name: 'Nigeria', nameAr: 'نيجيريا', code: 'NGA', flag: '🇳🇬', group: 'G', fifaRank: 36, primaryColor: '#008751', region: 'CAF' },
  // ── Group H ──
  { id: 'croatia', name: 'Croatia', nameAr: 'كرواتيا', code: 'CRO', flag: '🇭🇷', group: 'H', fifaRank: 10, primaryColor: '#171796', region: 'UEFA' },
  { id: 'denmark', name: 'Denmark', nameAr: 'الدنمارك', code: 'DEN', flag: '🇩🇰', group: 'H', fifaRank: 21, primaryColor: '#C60C30', region: 'UEFA' },
  { id: 'saudi-arabia', name: 'Saudi Arabia', nameAr: 'السعودية', code: 'KSA', flag: '🇸🇦', group: 'H', fifaRank: 53, primaryColor: '#006C35', region: 'AFC' },
  { id: 'cameroon', name: 'Cameroon', nameAr: 'الكاميرون', code: 'CMR', flag: '🇨🇲', group: 'H', fifaRank: 49, primaryColor: '#006334', region: 'CAF' },
  // ── Group I ──
  { id: 'belgium', name: 'Belgium', nameAr: 'بلجيكا', code: 'BEL', flag: '🇧🇪', group: 'I', fifaRank: 16, primaryColor: '#ED2939', region: 'UEFA' },
  { id: 'switzerland', name: 'Switzerland', nameAr: 'سويسرا', code: 'SUI', flag: '🇨🇭', group: 'I', fifaRank: 17, primaryColor: '#FF0000', region: 'UEFA' },
  { id: 'japan', name: 'Japan', nameAr: 'اليابان', code: 'JPN', flag: '🇯🇵', group: 'I', fifaRank: 18, primaryColor: '#BC002D', region: 'AFC' },
  { id: 'mali', name: 'Mali', nameAr: 'مالي', code: 'MLI', flag: '🇲🇱', group: 'I', fifaRank: 50, primaryColor: '#14B53A', region: 'CAF' },
  // ── Group J ──
  { id: 'uruguay', name: 'Uruguay', nameAr: 'أوروغواي', code: 'URU', flag: '🇺🇾', group: 'J', fifaRank: 11, primaryColor: '#5CBFF0', region: 'CONMEBOL' },
  { id: 'serbia', name: 'Serbia', nameAr: 'صربيا', code: 'SRB', flag: '🇷🇸', group: 'J', fifaRank: 33, primaryColor: '#C6363C', region: 'UEFA' },
  { id: 'iran', name: 'Iran', nameAr: 'إيران', code: 'IRN', flag: '🇮🇷', group: 'J', fifaRank: 20, primaryColor: '#239F40', region: 'AFC' },
  { id: 'chile', name: 'Chile', nameAr: 'تشيلي', code: 'CHI', flag: '🇨🇱', group: 'J', fifaRank: 52, primaryColor: '#D52B1E', region: 'CONMEBOL' },
  // ── Group K ──
  { id: 'algeria', name: 'Algeria', nameAr: 'الجزائر', code: 'ALG', flag: '🇩🇿', group: 'K', fifaRank: 37, primaryColor: '#006233', region: 'CAF' },
  { id: 'austria', name: 'Austria', nameAr: 'النمسا', code: 'AUT', flag: '🇦🇹', group: 'K', fifaRank: 22, primaryColor: '#ED2939', region: 'UEFA' },
  { id: 'poland', name: 'Poland', nameAr: 'بولندا', code: 'POL', flag: '🇵🇱', group: 'K', fifaRank: 30, primaryColor: '#DC143C', region: 'UEFA' },
  { id: 'qatar', name: 'Qatar', nameAr: 'قطر', code: 'QAT', flag: '🇶🇦', group: 'K', fifaRank: 46, primaryColor: '#8A1538', region: 'AFC' },
  // ── Group L ──
  { id: 'egypt', name: 'Egypt', nameAr: 'مصر', code: 'EGY', flag: '🇪🇬', group: 'L', fifaRank: 32, primaryColor: '#C8102E', region: 'CAF' },
  { id: 'sweden', name: 'Sweden', nameAr: 'السويد', code: 'SWE', flag: '🇸🇪', group: 'L', fifaRank: 26, primaryColor: '#006AA7', region: 'UEFA' },
  { id: 'wales', name: 'Wales', nameAr: 'ويلز', code: 'WAL', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', group: 'L', fifaRank: 29, primaryColor: '#00AB4D', region: 'UEFA' },
  { id: 'iraq', name: 'Iraq', nameAr: 'العراق', code: 'IRQ', flag: '🇮🇶', group: 'L', fifaRank: 56, primaryColor: '#CE1126', region: 'AFC' },
]

export const WC_STAGES = [
  { name: 'Group Stage', nameAr: 'دور المجموعات', order: 1 },
  { name: 'Round of 32', nameAr: 'دور الـ 32', order: 2 },
  { name: 'Round of 16', nameAr: 'دور الـ 16', order: 3 },
  { name: 'Quarter Finals', nameAr: 'ربع النهائي', order: 4 },
  { name: 'Semi Finals', nameAr: 'نصف النهائي', order: 5 },
  { name: 'Final', nameAr: 'النهائي', order: 6 },
]

export function findNationalTeam(query: string): NationalTeam | undefined {
  const q = query.toLowerCase().trim()
  return NATIONAL_TEAMS.find(t =>
    t.id === q ||
    t.code.toLowerCase() === q ||
    t.name.toLowerCase().includes(q) ||
    t.nameAr.includes(q)
  )
}

export function getTeamsByGroup(group: string): NationalTeam[] {
  return NATIONAL_TEAMS.filter(t => t.group === group.toUpperCase())
}

export function getGroups(): string[] {
  return [...new Set(NATIONAL_TEAMS.map(t => t.group))].sort()
}
