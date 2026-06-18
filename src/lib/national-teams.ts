/**
 * Fan Pulse — National Teams registry for World Cup 2026
 * 48 teams across 12 groups (A-L)
 *
 * Group compositions verified against:
 *  - FIFA.com official fixtures
 *  - olympics.com official group listings
 *  - Wikipedia "2026 FIFA World Cup" group articles
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
  // ── Group A ── Mexico, South Africa, Korea Republic, Czechia
  { id: 'mexico', name: 'Mexico', nameAr: 'المكسيك', code: 'MEX', flag: '🇲🇽', group: 'A', fifaRank: 15, primaryColor: '#006341', region: 'CONCACAF' },
  { id: 'south-africa', name: 'South Africa', nameAr: 'جنوب أفريقيا', code: 'RSA', flag: '🇿🇦', group: 'A', fifaRank: 57, primaryColor: '#007749', region: 'CAF' },
  { id: 'south-korea', name: 'South Korea', nameAr: 'كوريا الجنوبية', code: 'KOR', flag: '🇰🇷', group: 'A', fifaRank: 23, primaryColor: '#CD2E3A', region: 'AFC' },
  { id: 'czechia', name: 'Czechia', nameAr: 'التشيك', code: 'CZE', flag: '🇨🇿', group: 'A', fifaRank: 36, primaryColor: '#11457E', region: 'UEFA' },

  // ── Group B ── Canada, Bosnia and Herzegovina, Qatar, Switzerland
  { id: 'canada', name: 'Canada', nameAr: 'كندا', code: 'CAN', flag: '🇨🇦', group: 'B', fifaRank: 47, primaryColor: '#FF0000', region: 'CONCACAF' },
  { id: 'bosnia', name: 'Bosnia and Herzegovina', nameAr: 'البوسنة', code: 'BIH', flag: '🇧🇦', group: 'B', fifaRank: 55, primaryColor: '#002395', region: 'UEFA' },
  { id: 'qatar', name: 'Qatar', nameAr: 'قطر', code: 'QAT', flag: '🇶🇦', group: 'B', fifaRank: 48, primaryColor: '#8D1B3D', region: 'AFC' },
  { id: 'switzerland', name: 'Switzerland', nameAr: 'سويسرا', code: 'SUI', flag: '🇨🇭', group: 'B', fifaRank: 14, primaryColor: '#FF0000', region: 'UEFA' },

  // ── Group C ── Brazil, Haiti, Morocco, Scotland
  { id: 'brazil', name: 'Brazil', nameAr: 'البرازيل', code: 'BRA', flag: '🇧🇷', group: 'C', fifaRank: 3, primaryColor: '#009739', region: 'CONMEBOL' },
  { id: 'haiti', name: 'Haiti', nameAr: 'هايتي', code: 'HAI', flag: '🇭🇹', group: 'C', fifaRank: 78, primaryColor: '#00209F', region: 'CONCACAF' },
  { id: 'morocco', name: 'Morocco', nameAr: 'المغرب', code: 'MAR', flag: '🇲🇦', group: 'C', fifaRank: 12, primaryColor: '#C1272D', region: 'CAF' },
  { id: 'scotland', name: 'Scotland', nameAr: 'اسكتلندا', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C', fifaRank: 34, primaryColor: '#003087', region: 'UEFA' },

  // ── Group D ── Australia, Paraguay, Türkiye, USA
  { id: 'usa', name: 'United States', nameAr: 'الولايات المتحدة', code: 'USA', flag: '🇺🇸', group: 'D', fifaRank: 13, primaryColor: '#3C3B6E', region: 'CONCACAF' },
  { id: 'paraguay', name: 'Paraguay', nameAr: 'باراغواي', code: 'PAR', flag: '🇵🇾', group: 'D', fifaRank: 50, primaryColor: '#D52B1E', region: 'CONMEBOL' },
  { id: 'australia', name: 'Australia', nameAr: 'أستراليا', code: 'AUS', flag: '🇦🇺', group: 'D', fifaRank: 38, primaryColor: '#FFD700', region: 'AFC' },
  { id: 'turkiye', name: 'Turkiye', nameAr: 'تركيا', code: 'TUR', flag: '🇹🇷', group: 'D', fifaRank: 28, primaryColor: '#E30A17', region: 'UEFA' },

  // ── Group E ── Curaçao, Ecuador, Germany, Côte d'Ivoire
  { id: 'germany', name: 'Germany', nameAr: 'ألمانيا', code: 'GER', flag: '🇩🇪', group: 'E', fifaRank: 10, primaryColor: '#000000', region: 'UEFA' },
  { id: 'curacao', name: 'Curacao', nameAr: 'كوراساو', code: 'CUW', flag: '🇨🇼', group: 'E', fifaRank: 80, primaryColor: '#002B7F', region: 'CONCACAF' },
  { id: 'ivory-coast', name: 'Côte d\'Ivoire', nameAr: 'ساحل العاج', code: 'CIV', flag: '🇨🇮', group: 'E', fifaRank: 41, primaryColor: '#F77F00', region: 'CAF' },
  { id: 'ecuador', name: 'Ecuador', nameAr: 'الإكوادور', code: 'ECU', flag: '🇪🇨', group: 'E', fifaRank: 30, primaryColor: '#FFD100', region: 'CONMEBOL' },

  // ── Group F ── Japan, Netherlands, Sweden, Tunisia
  { id: 'netherlands', name: 'Netherlands', nameAr: 'هولندا', code: 'NED', flag: '🇳🇱', group: 'F', fifaRank: 7, primaryColor: '#FF6600', region: 'UEFA' },
  { id: 'japan', name: 'Japan', nameAr: 'اليابان', code: 'JPN', flag: '🇯🇵', group: 'F', fifaRank: 20, primaryColor: '#BC002D', region: 'AFC' },
  { id: 'sweden', name: 'Sweden', nameAr: 'السويد', code: 'SWE', flag: '🇸🇪', group: 'F', fifaRank: 26, primaryColor: '#004B87', region: 'UEFA' },
  { id: 'tunisia', name: 'Tunisia', nameAr: 'تونس', code: 'TUN', flag: '🇹🇳', group: 'F', fifaRank: 49, primaryColor: '#E70013', region: 'CAF' },

  // ── Group G ── Belgium, Egypt, Iran, New Zealand
  { id: 'belgium', name: 'Belgium', nameAr: 'بلجيكا', code: 'BEL', flag: '🇧🇪', group: 'G', fifaRank: 5, primaryColor: '#ED2939', region: 'UEFA' },
  { id: 'egypt', name: 'Egypt', nameAr: 'مصر', code: 'EGY', flag: '🇪🇬', group: 'G', fifaRank: 32, primaryColor: '#C09300', region: 'CAF' },
  { id: 'iran', name: 'Iran', nameAr: 'إيران', code: 'IRN', flag: '🇮🇷', group: 'G', fifaRank: 22, primaryColor: '#239F40', region: 'AFC' },
  { id: 'new-zealand', name: 'New Zealand', nameAr: 'نيوزيلندا', code: 'NZL', flag: '🇳🇿', group: 'G', fifaRank: 85, primaryColor: '#000000', region: 'OFC' },

  // ── Group H ── Spain, Cabo Verde, Saudi Arabia, Uruguay
  { id: 'spain', name: 'Spain', nameAr: 'إسبانيا', code: 'ESP', flag: '🇪🇸', group: 'H', fifaRank: 8, primaryColor: '#C60B1E', region: 'UEFA' },
  { id: 'cape-verde', name: 'Cape Verde', nameAr: 'الرأس الأخضر', code: 'CPV', flag: '🇨🇻', group: 'H', fifaRank: 65, primaryColor: '#003893', region: 'CAF' },
  { id: 'saudi-arabia', name: 'Saudi Arabia', nameAr: 'السعودية', code: 'KSA', flag: '🇸🇦', group: 'H', fifaRank: 54, primaryColor: '#006C35', region: 'AFC' },
  { id: 'uruguay', name: 'Uruguay', nameAr: 'الأوروغواي', code: 'URU', flag: '🇺🇾', group: 'H', fifaRank: 11, primaryColor: '#5CBFF0', region: 'CONMEBOL' },

  // ── Group I ── France, Senegal, Iraq, Norway  (Matchday 1: scheduled Jun 16-17)
  { id: 'france', name: 'France', nameAr: 'فرنسا', code: 'FRA', flag: '🇫🇷', group: 'I', fifaRank: 2, primaryColor: '#002395', region: 'UEFA' },
  { id: 'senegal', name: 'Senegal', nameAr: 'السنغال', code: 'SEN', flag: '🇸🇳', group: 'I', fifaRank: 18, primaryColor: '#00853F', region: 'CAF' },
  { id: 'iraq', name: 'Iraq', nameAr: 'العراق', code: 'IRQ', flag: '🇮🇶', group: 'I', fifaRank: 58, primaryColor: '#CE1126', region: 'AFC' },
  { id: 'norway', name: 'Norway', nameAr: 'النرويج', code: 'NOR', flag: '🇳🇴', group: 'I', fifaRank: 33, primaryColor: '#EF2B2D', region: 'UEFA' },

  // ── Group J ── Argentina, Algeria, Austria, Jordan  (Matchday 1: scheduled Jun 17)
  { id: 'argentina', name: 'Argentina', nameAr: 'الأرجنتين', code: 'ARG', flag: '🇦🇷', group: 'J', fifaRank: 1, primaryColor: '#75AADB', region: 'CONMEBOL' },
  { id: 'algeria', name: 'Algeria', nameAr: 'الجزائر', code: 'ALG', flag: '🇩🇿', group: 'J', fifaRank: 37, primaryColor: '#006233', region: 'CAF' },
  { id: 'austria', name: 'Austria', nameAr: 'النمسا', code: 'AUT', flag: '🇦🇹', group: 'J', fifaRank: 24, primaryColor: '#ED2939', region: 'UEFA' },
  { id: 'jordan', name: 'Jordan', nameAr: 'الأردن', code: 'JOR', flag: '🇯🇴', group: 'J', fifaRank: 62, primaryColor: '#000000', region: 'AFC' },

  // ── Group K ── Portugal, DR Congo, Uzbekistan, Colombia  (Matchday 1: scheduled Jun 17)
  { id: 'portugal', name: 'Portugal', nameAr: 'البرتغال', code: 'POR', flag: '🇵🇹', group: 'K', fifaRank: 6, primaryColor: '#006600', region: 'UEFA' },
  { id: 'dr-congo', name: 'DR Congo', nameAr: 'الكونغو الديمقراطية', code: 'COD', flag: '🇨🇩', group: 'K', fifaRank: 56, primaryColor: '#007FFF', region: 'CAF' },
  { id: 'uzbekistan', name: 'Uzbekistan', nameAr: 'أوزبكستان', code: 'UZB', flag: '🇺🇿', group: 'K', fifaRank: 59, primaryColor: '#1EB53A', region: 'AFC' },
  { id: 'colombia', name: 'Colombia', nameAr: 'كولومبيا', code: 'COL', flag: '🇨🇴', group: 'K', fifaRank: 17, primaryColor: '#FCD116', region: 'CONMEBOL' },

  // ── Group L ── England, Croatia, Ghana, Panama  (Matchday 1: scheduled Jun 17-18)
  { id: 'england', name: 'England', nameAr: 'إنجلترا', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L', fifaRank: 4, primaryColor: '#FFFFFF', region: 'UEFA' },
  { id: 'croatia', name: 'Croatia', nameAr: 'كرواتيا', code: 'CRO', flag: '🇭🇷', group: 'L', fifaRank: 10, primaryColor: '#171796', region: 'UEFA' },
  { id: 'ghana', name: 'Ghana', nameAr: 'غانا', code: 'GHA', flag: '🇬🇭', group: 'L', fifaRank: 61, primaryColor: '#CE1126', region: 'CAF' },
  { id: 'panama', name: 'Panama', nameAr: 'بنما', code: 'PAN', flag: '🇵🇦', group: 'L', fifaRank: 75, primaryColor: '#005EB8', region: 'CONCACAF' },
]

export const WC_STAGES = [
  { name: 'Group Stage', nameAr: 'دور المجموعات', order: 1 },
  { name: 'Round of 32', nameAr: 'دور الـ 32', order: 2 },
  { name: 'Round of 16', nameAr: 'دور الـ 16', order: 3 },
  { name: 'Quarter Finals', nameAr: 'ربع النهائي', order: 4 },
  { name: 'Semi Finals', nameAr: 'نصف النهائي', order: 5 },
  { name: 'Third Place', nameAr: 'مركز الثالث', order: 6 },
  { name: 'Final', nameAr: 'النهائي', order: 7 },
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
