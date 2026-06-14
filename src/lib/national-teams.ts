/**
 * Fan Pulse — National Teams registry for World Cup 2026
 * 48 teams in the expanded 2026 format across 12 groups
 * Real groups from the FIFA World Cup 2026 Final Draw (Dec 5, 2025)
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
  // ── Group A ── Mexico, South Africa, South Korea, Czech Republic
  { id: 'mexico', name: 'Mexico', nameAr: 'المكسيك', code: 'MEX', flag: '🇲🇽', group: 'A', fifaRank: 15, primaryColor: '#006341', region: 'CONCACAF' },
  { id: 'south-africa', name: 'South Africa', nameAr: 'جنوب أفريقيا', code: 'RSA', flag: '🇿🇦', group: 'A', fifaRank: 57, primaryColor: '#007749', region: 'CAF' },
  { id: 'south-korea', name: 'South Korea', nameAr: 'كوريا الجنوبية', code: 'KOR', flag: '🇰🇷', group: 'A', fifaRank: 23, primaryColor: '#CD2E3A', region: 'AFC' },
  { id: 'czech-republic', name: 'Czech Republic', nameAr: 'التشيك', code: 'CZE', flag: '🇨🇿', group: 'A', fifaRank: 42, primaryColor: '#11457E', region: 'UEFA' },

  // ── Group B ── Canada, Bosnia and Herzegovina, Qatar, Switzerland
  { id: 'canada', name: 'Canada', nameAr: 'كندا', code: 'CAN', flag: '🇨🇦', group: 'B', fifaRank: 47, primaryColor: '#FF0000', region: 'CONCACAF' },
  { id: 'bosnia', name: 'Bosnia and Herzegovina', nameAr: 'البوسنة والهرسك', code: 'BIH', flag: '🇧🇦', group: 'B', fifaRank: 59, primaryColor: '#002395', region: 'UEFA' },
  { id: 'qatar', name: 'Qatar', nameAr: 'قطر', code: 'QAT', flag: '🇶🇦', group: 'B', fifaRank: 46, primaryColor: '#8A1538', region: 'AFC' },
  { id: 'switzerland', name: 'Switzerland', nameAr: 'سويسرا', code: 'SUI', flag: '🇨🇭', group: 'B', fifaRank: 17, primaryColor: '#FF0000', region: 'UEFA' },

  // ── Group C ── Brazil, Morocco, Haiti, Scotland
  { id: 'brazil', name: 'Brazil', nameAr: 'البرازيل', code: 'BRA', flag: '🇧🇷', group: 'C', fifaRank: 5, primaryColor: '#009739', region: 'CONMEBOL' },
  { id: 'morocco', name: 'Morocco', nameAr: 'المغرب', code: 'MAR', flag: '🇲🇦', group: 'C', fifaRank: 14, primaryColor: '#C1272D', region: 'CAF' },
  { id: 'haiti', name: 'Haiti', nameAr: 'هايتي', code: 'HAI', flag: '🇭🇹', group: 'C', fifaRank: 83, primaryColor: '#00209F', region: 'CONCACAF' },
  { id: 'scotland', name: 'Scotland', nameAr: 'اسكتلندا', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C', fifaRank: 39, primaryColor: '#003078', region: 'UEFA' },

  // ── Group D ── United States, Paraguay, Australia, Turkey
  { id: 'usa', name: 'United States', nameAr: 'الولايات المتحدة', code: 'USA', flag: '🇺🇸', group: 'D', fifaRank: 13, primaryColor: '#3C3B6E', region: 'CONCACAF' },
  { id: 'paraguay', name: 'Paraguay', nameAr: 'باراغواي', code: 'PAR', flag: '🇵🇾', group: 'D', fifaRank: 55, primaryColor: '#D52B1E', region: 'CONMEBOL' },
  { id: 'australia', name: 'Australia', nameAr: 'أستراليا', code: 'AUS', flag: '🇦🇺', group: 'D', fifaRank: 25, primaryColor: '#FFD700', region: 'AFC' },
  { id: 'turkey', name: 'Turkey', nameAr: 'تركيا', code: 'TUR', flag: '🇹🇷', group: 'D', fifaRank: 38, primaryColor: '#E30A17', region: 'UEFA' },

  // ── Group E ── Germany, Curaçao, Ivory Coast, Ecuador
  { id: 'germany', name: 'Germany', nameAr: 'ألمانيا', code: 'GER', flag: '🇩🇪', group: 'E', fifaRank: 3, primaryColor: '#000000', region: 'UEFA' },
  { id: 'curacao', name: 'Curaçao', nameAr: 'كوراساو', code: 'CUW', flag: '🇨🇼', group: 'E', fifaRank: 79, primaryColor: '#002B7F', region: 'CONCACAF' },
  { id: 'ivory-coast', name: "Ivory Coast", nameAr: "كوت ديفوار", code: 'CIV', flag: '🇨🇮', group: 'E', fifaRank: 40, primaryColor: '#F77F00', region: 'CAF' },
  { id: 'ecuador', name: 'Ecuador', nameAr: 'الإكوادور', code: 'ECU', flag: '🇪🇨', group: 'E', fifaRank: 35, primaryColor: '#FFD100', region: 'CONMEBOL' },

  // ── Group F ── Netherlands, Japan, Sweden, Tunisia
  { id: 'netherlands', name: 'Netherlands', nameAr: 'هولندا', code: 'NED', flag: '🇳🇱', group: 'F', fifaRank: 7, primaryColor: '#FF6600', region: 'UEFA' },
  { id: 'japan', name: 'Japan', nameAr: 'اليابان', code: 'JPN', flag: '🇯🇵', group: 'F', fifaRank: 18, primaryColor: '#BC002D', region: 'AFC' },
  { id: 'sweden', name: 'Sweden', nameAr: 'السويد', code: 'SWE', flag: '🇸🇪', group: 'F', fifaRank: 26, primaryColor: '#006AA7', region: 'UEFA' },
  { id: 'tunisia', name: 'Tunisia', nameAr: 'تونس', code: 'TUN', flag: '🇹🇳', group: 'F', fifaRank: 28, primaryColor: '#E70013', region: 'CAF' },

  // ── Group G ── Belgium, Egypt, Iran, New Zealand
  { id: 'belgium', name: 'Belgium', nameAr: 'بلجيكا', code: 'BEL', flag: '🇧🇪', group: 'G', fifaRank: 16, primaryColor: '#ED2939', region: 'UEFA' },
  { id: 'egypt', name: 'Egypt', nameAr: 'مصر', code: 'EGY', flag: '🇪🇬', group: 'G', fifaRank: 32, primaryColor: '#C8102E', region: 'CAF' },
  { id: 'iran', name: 'Iran', nameAr: 'إيران', code: 'IRN', flag: '🇮🇷', group: 'G', fifaRank: 20, primaryColor: '#239F40', region: 'AFC' },
  { id: 'new-zealand', name: 'New Zealand', nameAr: 'نيوزيلندا', code: 'NZL', flag: '🇳🇿', group: 'G', fifaRank: 98, primaryColor: '#000000', region: 'OFC' },

  // ── Group H ── Spain, Cape Verde, Saudi Arabia, Uruguay
  { id: 'spain', name: 'Spain', nameAr: 'إسبانيا', code: 'ESP', flag: '🇪🇸', group: 'H', fifaRank: 8, primaryColor: '#C60B1E', region: 'UEFA' },
  { id: 'cape-verde', name: 'Cape Verde', nameAr: 'الرأس الأخضر', code: 'CPV', flag: '🇨🇻', group: 'H', fifaRank: 72, primaryColor: '#003893', region: 'CAF' },
  { id: 'saudi-arabia', name: 'Saudi Arabia', nameAr: 'السعودية', code: 'KSA', flag: '🇸🇦', group: 'H', fifaRank: 53, primaryColor: '#006C35', region: 'AFC' },
  { id: 'uruguay', name: 'Uruguay', nameAr: 'أوروغواي', code: 'URU', flag: '🇺🇾', group: 'H', fifaRank: 11, primaryColor: '#5CBFF0', region: 'CONMEBOL' },

  // ── Group I ── France, Senegal, Iraq, Norway
  { id: 'france', name: 'France', nameAr: 'فرنسا', code: 'FRA', flag: '🇫🇷', group: 'I', fifaRank: 2, primaryColor: '#002395', region: 'UEFA' },
  { id: 'senegal', name: 'Senegal', nameAr: 'السنغال', code: 'SEN', flag: '🇸🇳', group: 'I', fifaRank: 19, primaryColor: '#00853F', region: 'CAF' },
  { id: 'iraq', name: 'Iraq', nameAr: 'العراق', code: 'IRQ', flag: '🇮🇶', group: 'I', fifaRank: 56, primaryColor: '#CE1126', region: 'AFC' },
  { id: 'norway', name: 'Norway', nameAr: 'النرويج', code: 'NOR', flag: '🇳🇴', group: 'I', fifaRank: 43, primaryColor: '#BA0C2F', region: 'UEFA' },

  // ── Group J ── Argentina, Algeria, Austria, Jordan
  { id: 'argentina', name: 'Argentina', nameAr: 'الأرجنتين', code: 'ARG', flag: '🇦🇷', group: 'J', fifaRank: 1, primaryColor: '#75AADB', region: 'CONMEBOL' },
  { id: 'algeria', name: 'Algeria', nameAr: 'الجزائر', code: 'ALG', flag: '🇩🇿', group: 'J', fifaRank: 37, primaryColor: '#006233', region: 'CAF' },
  { id: 'austria', name: 'Austria', nameAr: 'النمسا', code: 'AUT', flag: '🇦🇹', group: 'J', fifaRank: 22, primaryColor: '#ED2939', region: 'UEFA' },
  { id: 'jordan', name: 'Jordan', nameAr: 'الأردن', code: 'JOR', flag: '🇯🇴', group: 'J', fifaRank: 71, primaryColor: '#CE1126', region: 'AFC' },

  // ── Group K ── Portugal, DR Congo, Uzbekistan, Colombia
  { id: 'portugal', name: 'Portugal', nameAr: 'البرتغال', code: 'POR', flag: '🇵🇹', group: 'K', fifaRank: 6, primaryColor: '#006600', region: 'UEFA' },
  { id: 'dr-congo', name: 'DR Congo', nameAr: 'الكونغو الديمقراطية', code: 'COD', flag: '🇨🇩', group: 'K', fifaRank: 61, primaryColor: '#007FFF', region: 'CAF' },
  { id: 'uzbekistan', name: 'Uzbekistan', nameAr: 'أوزبكستان', code: 'UZB', flag: '🇺🇿', group: 'K', fifaRank: 58, primaryColor: '#1EB53A', region: 'AFC' },
  { id: 'colombia', name: 'Colombia', nameAr: 'كولومبيا', code: 'COL', flag: '🇨🇴', group: 'K', fifaRank: 12, primaryColor: '#FCD116', region: 'CONMEBOL' },

  // ── Group L ── England, Croatia, Ghana, Panama
  { id: 'england', name: 'England', nameAr: 'إنجلترا', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L', fifaRank: 4, primaryColor: '#FFFFFF', region: 'UEFA' },
  { id: 'croatia', name: 'Croatia', nameAr: 'كرواتيا', code: 'CRO', flag: '🇭🇷', group: 'L', fifaRank: 10, primaryColor: '#171796', region: 'UEFA' },
  { id: 'ghana', name: 'Ghana', nameAr: 'غانا', code: 'GHA', flag: '🇬🇭', group: 'L', fifaRank: 65, primaryColor: '#CE1126', region: 'CAF' },
  { id: 'panama', name: 'Panama', nameAr: 'بنما', code: 'PAN', flag: '🇵🇦', group: 'L', fifaRank: 85, primaryColor: '#005293', region: 'CONCACAF' },
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
