/**
 * Fan Pulse — National Teams registry for World Cup 2026
 * 48 teams across 12 groups (A-L)
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
  // ── Group A ── Mexico, South Africa, South Korea, Czechia
  { id: 'mexico', name: 'Mexico', nameAr: 'المكسيك', code: 'MEX', flag: '🇲🇽', group: 'A', fifaRank: 15, primaryColor: '#006341', region: 'CONCACAF' },
  { id: 'south-africa', name: 'South Africa', nameAr: 'جنوب أفريقيا', code: 'RSA', flag: '🇿🇦', group: 'A', fifaRank: 57, primaryColor: '#007749', region: 'CAF' },
  { id: 'south-korea', name: 'South Korea', nameAr: 'كوريا الجنوبية', code: 'KOR', flag: '🇰🇷', group: 'A', fifaRank: 23, primaryColor: '#CD2E3A', region: 'AFC' },
  { id: 'czechia', name: 'Czechia', nameAr: 'التشيك', code: 'CZE', flag: '🇨🇿', group: 'A', fifaRank: 36, primaryColor: '#11457E', region: 'UEFA' },

  // ── Group B ── Canada, Bosnia and Herzegovina, Switzerland, Denmark
  { id: 'canada', name: 'Canada', nameAr: 'كندا', code: 'CAN', flag: '🇨🇦', group: 'B', fifaRank: 47, primaryColor: '#FF0000', region: 'CONCACAF' },
  { id: 'bosnia', name: 'Bosnia and Herzegovina', nameAr: 'البوسنة', code: 'BIH', flag: '🇧🇦', group: 'B', fifaRank: 55, primaryColor: '#002395', region: 'UEFA' },
  { id: 'switzerland', name: 'Switzerland', nameAr: 'سويسرا', code: 'SUI', flag: '🇨🇭', group: 'B', fifaRank: 14, primaryColor: '#FF0000', region: 'UEFA' },
  { id: 'denmark', name: 'Denmark', nameAr: 'الدنمارك', code: 'DEN', flag: '🇩🇰', group: 'B', fifaRank: 21, primaryColor: '#C60C30', region: 'UEFA' },

  // ── Group C ── Brazil, Morocco, Scotland, Cape Verde
  { id: 'brazil', name: 'Brazil', nameAr: 'البرازيل', code: 'BRA', flag: '🇧🇷', group: 'C', fifaRank: 3, primaryColor: '#009739', region: 'CONMEBOL' },
  { id: 'morocco', name: 'Morocco', nameAr: 'المغرب', code: 'MAR', flag: '🇲🇦', group: 'C', fifaRank: 12, primaryColor: '#C1272D', region: 'CAF' },
  { id: 'scotland', name: 'Scotland', nameAr: 'اسكتلندا', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C', fifaRank: 34, primaryColor: '#003087', region: 'UEFA' },
  { id: 'cape-verde', name: 'Cape Verde', nameAr: 'الرأس الأخضر', code: 'CPV', flag: '🇨🇻', group: 'C', fifaRank: 65, primaryColor: '#003893', region: 'CAF' },

  // ── Group D ── USA, Paraguay, Australia, Turkiye
  { id: 'usa', name: 'United States', nameAr: 'الولايات المتحدة', code: 'USA', flag: '🇺🇸', group: 'D', fifaRank: 13, primaryColor: '#3C3B6E', region: 'CONCACAF' },
  { id: 'paraguay', name: 'Paraguay', nameAr: 'باراغواي', code: 'PAR', flag: '🇵🇾', group: 'D', fifaRank: 50, primaryColor: '#D52B1E', region: 'CONMEBOL' },
  { id: 'australia', name: 'Australia', nameAr: 'أستراليا', code: 'AUS', flag: '🇦🇺', group: 'D', fifaRank: 38, primaryColor: '#FFD700', region: 'AFC' },
  { id: 'turkiye', name: 'Turkiye', nameAr: 'تركيا', code: 'TUR', flag: '🇹🇷', group: 'D', fifaRank: 28, primaryColor: '#E30A17', region: 'UEFA' },

  // ── Group E ── Germany, Curacao, Sweden, Nigeria
  { id: 'germany', name: 'Germany', nameAr: 'ألمانيا', code: 'GER', flag: '🇩🇪', group: 'E', fifaRank: 10, primaryColor: '#000000', region: 'UEFA' },
  { id: 'curacao', name: 'Curacao', nameAr: 'كوراساو', code: 'CUW', flag: '🇨🇼', group: 'E', fifaRank: 80, primaryColor: '#002B7F', region: 'CONCACAF' },
  { id: 'sweden', name: 'Sweden', nameAr: 'السويد', code: 'SWE', flag: '🇸🇪', group: 'E', fifaRank: 26, primaryColor: '#004B87', region: 'UEFA' },
  { id: 'nigeria', name: 'Nigeria', nameAr: 'نيجيريا', code: 'NGA', flag: '🇳🇬', group: 'E', fifaRank: 39, primaryColor: '#008751', region: 'CAF' },

  // ── Group F ── Argentina, Colombia, Uzbekistan, Cameroon
  { id: 'argentina', name: 'Argentina', nameAr: 'الأرجنتين', code: 'ARG', flag: '🇦🇷', group: 'F', fifaRank: 1, primaryColor: '#75AADB', region: 'CONMEBOL' },
  { id: 'colombia', name: 'Colombia', nameAr: 'كولومبيا', code: 'COL', flag: '🇨🇴', group: 'F', fifaRank: 17, primaryColor: '#FCD116', region: 'CONMEBOL' },
  { id: 'uzbekistan', name: 'Uzbekistan', nameAr: 'أوزبكستان', code: 'UZB', flag: '🇺🇿', group: 'F', fifaRank: 59, primaryColor: '#1EB53A', region: 'AFC' },
  { id: 'cameroon', name: 'Cameroon', nameAr: 'الكاميرون', code: 'CMR', flag: '🇨🇲', group: 'F', fifaRank: 43, primaryColor: '#006633', region: 'CAF' },

  // ── Group G ── Italy, Chile, Ecuador, Algeria
  { id: 'italy', name: 'Italy', nameAr: 'إيطاليا', code: 'ITA', flag: '🇮🇹', group: 'G', fifaRank: 9, primaryColor: '#008C45', region: 'UEFA' },
  { id: 'chile', name: 'Chile', nameAr: 'تشيلي', code: 'CHI', flag: '🇨🇱', group: 'G', fifaRank: 42, primaryColor: '#D52B1E', region: 'CONMEBOL' },
  { id: 'ecuador', name: 'Ecuador', nameAr: 'الإكوادور', code: 'ECU', flag: '🇪🇨', group: 'G', fifaRank: 30, primaryColor: '#FFD100', region: 'CONMEBOL' },
  { id: 'algeria', name: 'Algeria', nameAr: 'الجزائر', code: 'ALG', flag: '🇩🇿', group: 'G', fifaRank: 37, primaryColor: '#006233', region: 'CAF' },

  // ── Group H ── France, Portugal, Peru, Jamaica
  { id: 'france', name: 'France', nameAr: 'فرنسا', code: 'FRA', flag: '🇫🇷', group: 'H', fifaRank: 2, primaryColor: '#002395', region: 'UEFA' },
  { id: 'portugal', name: 'Portugal', nameAr: 'البرتغال', code: 'POR', flag: '🇵🇹', group: 'H', fifaRank: 6, primaryColor: '#006600', region: 'UEFA' },
  { id: 'peru', name: 'Peru', nameAr: 'بيرو', code: 'PER', flag: '🇵🇪', group: 'H', fifaRank: 44, primaryColor: '#D91023', region: 'CONMEBOL' },
  { id: 'jamaica', name: 'Jamaica', nameAr: 'جامايكا', code: 'JAM', flag: '🇯🇲', group: 'H', fifaRank: 53, primaryColor: '#009B3A', region: 'CONCACAF' },

  // ── Group I ── Netherlands, Senegal, Costa Rica, Wales
  { id: 'netherlands', name: 'Netherlands', nameAr: 'هولندا', code: 'NED', flag: '🇳🇱', group: 'I', fifaRank: 7, primaryColor: '#FF6600', region: 'UEFA' },
  { id: 'senegal', name: 'Senegal', nameAr: 'السنغال', code: 'SEN', flag: '🇸🇳', group: 'I', fifaRank: 18, primaryColor: '#00853F', region: 'CAF' },
  { id: 'costa-rica', name: 'Costa Rica', nameAr: 'كوستاريكا', code: 'CRC', flag: '🇨🇷', group: 'I', fifaRank: 52, primaryColor: '#002B7F', region: 'CONCACAF' },
  { id: 'wales', name: 'Wales', nameAr: 'ويلز', code: 'WAL', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', group: 'I', fifaRank: 29, primaryColor: '#00AB4D', region: 'UEFA' },

  // ── Group J ── England, Uruguay, Poland, Ghana
  { id: 'england', name: 'England', nameAr: 'إنجلترا', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'J', fifaRank: 4, primaryColor: '#FFFFFF', region: 'UEFA' },
  { id: 'uruguay', name: 'Uruguay', nameAr: 'الأوروغواي', code: 'URU', flag: '🇺🇾', group: 'J', fifaRank: 11, primaryColor: '#5CBFF0', region: 'CONMEBOL' },
  { id: 'poland', name: 'Poland', nameAr: 'بولندا', code: 'POL', flag: '🇵🇱', group: 'J', fifaRank: 25, primaryColor: '#DC143C', region: 'UEFA' },
  { id: 'ghana', name: 'Ghana', nameAr: 'غانا', code: 'GHA', flag: '🇬🇭', group: 'J', fifaRank: 61, primaryColor: '#CE1126', region: 'CAF' },

  // ── Group K ── Spain, Croatia, Honduras, Iceland
  { id: 'spain', name: 'Spain', nameAr: 'إسبانيا', code: 'ESP', flag: '🇪🇸', group: 'K', fifaRank: 8, primaryColor: '#C60B1E', region: 'UEFA' },
  { id: 'croatia', name: 'Croatia', nameAr: 'كرواتيا', code: 'CRO', flag: '🇭🇷', group: 'K', fifaRank: 10, primaryColor: '#171796', region: 'UEFA' },
  { id: 'honduras', name: 'Honduras', nameAr: 'هندوراس', code: 'HON', flag: '🇭🇳', group: 'K', fifaRank: 73, primaryColor: '#0073CF', region: 'CONCACAF' },
  { id: 'iceland', name: 'Iceland', nameAr: 'آيسلندا', code: 'ISL', flag: '🇮🇸', group: 'K', fifaRank: 70, primaryColor: '#003897', region: 'UEFA' },

  // ── Group L ── Japan, Belgium, New Zealand, Saudi Arabia
  { id: 'japan', name: 'Japan', nameAr: 'اليابان', code: 'JPN', flag: '🇯🇵', group: 'L', fifaRank: 20, primaryColor: '#BC002D', region: 'AFC' },
  { id: 'belgium', name: 'Belgium', nameAr: 'بلجيكا', code: 'BEL', flag: '🇧🇪', group: 'L', fifaRank: 5, primaryColor: '#ED2939', region: 'UEFA' },
  { id: 'new-zealand', name: 'New Zealand', nameAr: 'نيوزيلندا', code: 'NZL', flag: '🇳🇿', group: 'L', fifaRank: 85, primaryColor: '#000000', region: 'OFC' },
  { id: 'saudi-arabia', name: 'Saudi Arabia', nameAr: 'السعودية', code: 'KSA', flag: '🇸🇦', group: 'L', fifaRank: 54, primaryColor: '#006C35', region: 'AFC' },
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
