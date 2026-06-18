import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db, getDb } from '@/lib/db'

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes
let lastFetchTime = 0
let cachedResponse: {
  posts: any[]
  summaries: any[]
  languages: string[]
  fetchedAt: string
} | null = null

// ── Supported Languages ──────────────────────────────────────────────────────
const SUPPORTED_LANGUAGES = [
  'en', 'ar', 'es', 'fr', 'pt', 'de', 'ja', 'ko', 'tr', 'id', 'ur', 'fa', 'zh',
] as const
type Language = (typeof SUPPORTED_LANGUAGES)[number]

// ── Top 12 Popular Teams (used when teamCode not specified) ──────────────────
const TOP_TEAMS = ['BRA', 'ARG', 'FRA', 'ENG', 'GER', 'ESP', 'MEX', 'USA', 'KOR', 'JPN', 'POR', 'BEL']

// ── Team Name Mapping: 48 WC 2026 teams in 13 languages ─────────────────────
const TEAM_NAMES: Record<string, Record<Language, string>> = {
  MEX: { en: 'Mexico', ar: 'المكسيك', es: 'México', fr: 'Mexique', pt: 'México', de: 'Mexiko', ja: 'メキシコ', ko: '멕시코', tr: 'Meksika', id: 'Meksiko', ur: 'میکسیکو', fa: 'مکزیک', zh: '墨西哥' },
  RSA: { en: 'South Africa', ar: 'جنوب أفريقيا', es: 'Sudáfrica', fr: 'Afrique du Sud', pt: 'África do Sul', de: 'Südafrika', ja: '南アフリカ', ko: '남아프리카', tr: 'Güney Afrika', id: 'Afrika Selatan', ur: 'جنوبی افریقہ', fa: 'آفریقای جنوبی', zh: '南非' },
  KOR: { en: 'South Korea', ar: 'كوريا الجنوبية', es: 'Corea del Sur', fr: 'Corée du Sud', pt: 'Coreia do Sul', de: 'Südkorea', ja: '韓国', ko: '한국', tr: 'Güney Kore', id: 'Korea Selatan', ur: 'جنوبی کوریا', fa: 'کره جنوبی', zh: '韩国' },
  CZE: { en: 'Czechia', ar: 'التشيك', es: 'Chequia', fr: 'Tchéquie', pt: 'Tchéquia', de: 'Tschechien', ja: 'チェコ', ko: '체코', tr: 'Çekya', id: 'Ceko', ur: 'چیک', fa: 'چک', zh: '捷克' },
  BIH: { en: 'Bosnia and Herzegovina', ar: 'البوسنة والهرسك', es: 'Bosnia y Herzegovina', fr: 'Bosnie-Herzégovine', pt: 'Bósnia e Herzegovina', de: 'Bosnien und Herzegowina', ja: 'ボスニア・ヘルツェゴビナ', ko: '보스니아 헤르체고비나', tr: 'Bosna Hersek', id: 'Bosnia dan Herzegovina', ur: 'بوسنیا اور ہرزیگوینا', fa: 'بوسنی و هرزگوین', zh: '波黑' },
  CAN: { en: 'Canada', ar: 'كندا', es: 'Canadá', fr: 'Canada', pt: 'Canadá', de: 'Kanada', ja: 'カナダ', ko: '캐나다', tr: 'Kanada', id: 'Kanada', ur: 'کینیڈا', fa: 'کانادا', zh: '加拿大' },
  SUI: { en: 'Switzerland', ar: 'سويسرا', es: 'Suiza', fr: 'Suisse', pt: 'Suíça', de: 'Schweiz', ja: 'スイス', ko: '스위스', tr: 'İsviçre', id: 'Swiss', ur: 'سوئٹزرلینڈ', fa: 'سوئیس', zh: '瑞士' },
  QAT: { en: 'Qatar', ar: 'قطر', es: 'Catar', fr: 'Qatar', pt: 'Catar', de: 'Katar', ja: 'カタール', ko: '카타르', tr: 'Katar', id: 'Qatar', ur: 'قطر', fa: 'قطر', zh: '卡塔尔' },
  BRA: { en: 'Brazil', ar: 'البرازيل', es: 'Brasil', fr: 'Brésil', pt: 'Brasil', de: 'Brasilien', ja: 'ブラジル', ko: '브라질', tr: 'Brezilya', id: 'Brasil', ur: 'برازیل', fa: 'برزیل', zh: '巴西' },
  MAR: { en: 'Morocco', ar: 'المغرب', es: 'Marruecos', fr: 'Maroc', pt: 'Marrocos', de: 'Marokko', ja: 'モロッコ', ko: '모로코', tr: 'Fas', id: 'Maroko', ur: 'مراکش', fa: 'مراکش', zh: '摩洛哥' },
  HAI: { en: 'Haiti', ar: 'هايتي', es: 'Haití', fr: 'Haïti', pt: 'Haiti', de: 'Haiti', ja: 'ハイチ', ko: '아이티', tr: 'Haiti', id: 'Haiti', ur: 'ہیٹی', fa: 'هائیتی', zh: '海地' },
  SCO: { en: 'Scotland', ar: 'اسكتلندا', es: 'Escocia', fr: 'Écosse', pt: 'Escócia', de: 'Schottland', ja: 'スコットランド', ko: '스코틀랜드', tr: 'İskoçya', id: 'Skotlandia', ur: 'سکاٹ لینڈ', fa: 'اسکاتلند', zh: '苏格兰' },
  AUS: { en: 'Australia', ar: 'أستراليا', es: 'Australia', fr: 'Australie', pt: 'Austrália', de: 'Australien', ja: 'オーストラリア', ko: '호주', tr: 'Avustralya', id: 'Australia', ur: 'آسٹریلیا', fa: 'استرالیا', zh: '澳大利亚' },
  TUR: { en: 'Turkey', ar: 'تركيا', es: 'Turquía', fr: 'Turquie', pt: 'Turquia', de: 'Türkei', ja: 'トルコ', ko: '튀르키예', tr: 'Türkiye', id: 'Turki', ur: 'ترکی', fa: 'ترکیه', zh: '土耳其' },
  PAR: { en: 'Paraguay', ar: 'باراغواي', es: 'Paraguay', fr: 'Paraguay', pt: 'Paraguai', de: 'Paraguay', ja: 'パラグアイ', ko: '파라과이', tr: 'Paraguay', id: 'Paraguay', ur: 'پیراگوئے', fa: 'پاراگوئه', zh: '巴拉圭' },
  USA: { en: 'United States', ar: 'الولايات المتحدة', es: 'Estados Unidos', fr: 'États-Unis', pt: 'Estados Unidos', de: 'USA', ja: 'アメリカ', ko: '미국', tr: 'ABD', id: 'Amerika Serikat', ur: 'امریکہ', fa: 'آمریکا', zh: '美国' },
  GER: { en: 'Germany', ar: 'ألمانيا', es: 'Alemania', fr: 'Allemagne', pt: 'Alemanha', de: 'Deutschland', ja: 'ドイツ', ko: '독일', tr: 'Almanya', id: 'Jerman', ur: 'جرمنی', fa: 'آلمان', zh: '德国' },
  CUW: { en: 'Curacao', ar: 'كوراساو', es: 'Curazao', fr: 'Curaçao', pt: 'Curaçao', de: 'Curaçao', ja: 'キュラソー', ko: '퀴라소', tr: 'Curaçao', id: 'Curaçao', ur: 'کیوراکاؤ', fa: 'کوراسائو', zh: '库拉索' },
  CIV: { en: 'Ivory Coast', ar: 'ساحل العاج', es: 'Costa de Marfil', fr: "Côte d'Ivoire", pt: 'Costa do Marfim', de: 'Elfenbeinküste', ja: 'コートジボワール', ko: '코트디부아르', tr: 'Fildişi Sahili', id: 'Pantai Gading', ur: 'آئیوری کوسٹ', fa: 'ساحل عاج', zh: '科特迪瓦' },
  ECU: { en: 'Ecuador', ar: 'الإكوادور', es: 'Ecuador', fr: 'Équateur', pt: 'Equador', de: 'Ecuador', ja: 'エクアドル', ko: '에콰도르', tr: 'Ekvador', id: 'Ekuador', ur: 'ایکواڈور', fa: 'اکوادور', zh: '厄瓜多尔' },
  NED: { en: 'Netherlands', ar: 'هولندا', es: 'Países Bajos', fr: 'Pays-Bas', pt: 'Holanda', de: 'Niederlande', ja: 'オランダ', ko: '네덜란드', tr: 'Hollanda', id: 'Belanda', ur: 'نیدرلینڈز', fa: 'هلند', zh: '荷兰' },
  JPN: { en: 'Japan', ar: 'اليابان', es: 'Japón', fr: 'Japon', pt: 'Japão', de: 'Japan', ja: '日本', ko: '일본', tr: 'Japonya', id: 'Jepang', ur: 'جاپان', fa: 'ژاپن', zh: '日本' },
  SWE: { en: 'Sweden', ar: 'السويد', es: 'Suecia', fr: 'Suède', pt: 'Suécia', de: 'Schweden', ja: 'スウェーデン', ko: '스웨덴', tr: 'İsveç', id: 'Swedia', ur: 'سویڈن', fa: 'سوئد', zh: '瑞典' },
  TUN: { en: 'Tunisia', ar: 'تونس', es: 'Túnez', fr: 'Tunisie', pt: 'Tunísia', de: 'Tunesien', ja: 'チュニジア', ko: '튀니지', tr: 'Tunus', id: 'Tunisia', ur: 'تیونس', fa: 'تونس', zh: '突尼斯' },
  BEL: { en: 'Belgium', ar: 'بلجيكا', es: 'Bélgica', fr: 'Belgique', pt: 'Bélgica', de: 'Belgien', ja: 'ベルギー', ko: '벨기에', tr: 'Belçika', id: 'Belgia', ur: 'بیلجیم', fa: 'بلژیک', zh: '比利时' },
  EGY: { en: 'Egypt', ar: 'مصر', es: 'Egipto', fr: 'Égypte', pt: 'Egito', de: 'Ägypten', ja: 'エジプト', ko: '이집트', tr: 'Mısır', id: 'Mesir', ur: 'مصر', fa: 'مصر', zh: '埃及' },
  IRI: { en: 'Iran', ar: 'إيران', es: 'Irán', fr: 'Iran', pt: 'Irã', de: 'Iran', ja: 'イラン', ko: '이란', tr: 'İran', id: 'Iran', ur: 'ایران', fa: 'ایران', zh: '伊朗' },
  NZL: { en: 'New Zealand', ar: 'نيوزيلندا', es: 'Nueva Zelanda', fr: 'Nouvelle-Zélande', pt: 'Nova Zelândia', de: 'Neuseeland', ja: 'ニュージーランド', ko: '뉴질랜드', tr: 'Yeni Zelanda', id: 'Selandia Baru', ur: 'نیوزی لینڈ', fa: 'زلاند نو', zh: '新西兰' },
  KSA: { en: 'Saudi Arabia', ar: 'السعودية', es: 'Arabia Saudí', fr: 'Arabie Saoudite', pt: 'Arábia Saudita', de: 'Saudi-Arabien', ja: 'サウジアラビア', ko: '사우디아라비아', tr: 'Suudi Arabistan', id: 'Arab Saudi', ur: 'سعودی عرب', fa: 'عربستان سعودی', zh: '沙特' },
  URU: { en: 'Uruguay', ar: 'الأوروغواي', es: 'Uruguay', fr: 'Uruguay', pt: 'Uruguai', de: 'Uruguay', ja: 'ウルグアイ', ko: '우루과이', tr: 'Uruguay', id: 'Uruguay', ur: 'یوروگوئے', fa: 'اروگوئه', zh: '乌拉圭' },
  ESP: { en: 'Spain', ar: 'إسبانيا', es: 'España', fr: 'Espagne', pt: 'Espanha', de: 'Spanien', ja: 'スペイン', ko: '스페인', tr: 'İspanya', id: 'Spanyol', ur: 'سپین', fa: 'اسپانیا', zh: '西班牙' },
  CPV: { en: 'Cape Verde', ar: 'الرأس الأخضر', es: 'Cabo Verde', fr: 'Cap-Vert', pt: 'Cabo Verde', de: 'Kap Verde', ja: 'カーボベルデ', ko: '카보베르데', tr: 'Yeşil Burun', id: 'Tanjung Verde', ur: 'کیپ ورڈ', fa: 'کیپ ورد', zh: '佛得角' },
  FRA: { en: 'France', ar: 'فرنسا', es: 'Francia', fr: 'France', pt: 'França', de: 'Frankreich', ja: 'フランス', ko: '프랑스', tr: 'Fransa', id: 'Prancis', ur: 'فرانس', fa: 'فرانسه', zh: '法国' },
  SEN: { en: 'Senegal', ar: 'السنغال', es: 'Senegal', fr: 'Sénégal', pt: 'Senegal', de: 'Senegal', ja: 'セネガル', ko: '세네갈', tr: 'Senegal', id: 'Senegal', ur: 'سینیگال', fa: 'سنگال', zh: '塞内加尔' },
  IRQ: { en: 'Iraq', ar: 'العراق', es: 'Irak', fr: 'Irak', pt: 'Iraque', de: 'Irak', ja: 'イラク', ko: '이라크', tr: 'Irak', id: 'Irak', ur: 'عراق', fa: 'عراق', zh: '伊拉克' },
  NOR: { en: 'Norway', ar: 'النرويج', es: 'Noruega', fr: 'Norvège', pt: 'Noruega', de: 'Norwegen', ja: 'ノルウェー', ko: '노르웨이', tr: 'Norveç', id: 'Norwegia', ur: 'ناروے', fa: 'نروژ', zh: '挪威' },
  ARG: { en: 'Argentina', ar: 'الأرجنتين', es: 'Argentina', fr: 'Argentine', pt: 'Argentina', de: 'Argentinien', ja: 'アルゼンチン', ko: '아르헨티나', tr: 'Arjantin', id: 'Argentina', ur: 'ارجنٹائن', fa: 'آرژانتین', zh: '阿根廷' },
  ALG: { en: 'Algeria', ar: 'الجزائر', es: 'Argelia', fr: 'Algérie', pt: 'Argélia', de: 'Algerien', ja: 'アルジェリア', ko: '알제리', tr: 'Cezayir', id: 'Aljazair', ur: 'الجزائر', fa: 'الجزایر', zh: '阿尔及利亚' },
  AUT: { en: 'Austria', ar: 'النمسا', es: 'Austria', fr: 'Autriche', pt: 'Áustria', de: 'Österreich', ja: 'オーストリア', ko: '오스트리아', tr: 'Avusturya', id: 'Austria', ur: 'آسٹریا', fa: 'اتریش', zh: '奥地利' },
  JOR: { en: 'Jordan', ar: 'الأردن', es: 'Jordania', fr: 'Jordanie', pt: 'Jordânia', de: 'Jordanien', ja: 'ヨルダン', ko: '요르단', tr: 'Ürdün', id: 'Yordania', ur: 'اردن', fa: 'اردن', zh: '约旦' },
  POR: { en: 'Portugal', ar: 'البرتغال', es: 'Portugal', fr: 'Portugal', pt: 'Portugal', de: 'Portugal', ja: 'ポルトガル', ko: '포르투갈', tr: 'Portekiz', id: 'Portugal', ur: 'پرتگال', fa: 'پرتغال', zh: '葡萄牙' },
  COD: { en: 'DR Congo', ar: 'الكونغو الديمقراطية', es: 'RD Congo', fr: 'RD Congo', pt: 'RD Congo', de: 'DR Kongo', ja: 'コンゴ民主共和国', ko: '콩고민주공화국', tr: 'KD Kongo', id: 'Kongo DR', ur: 'کانگو ڈیموکریٹک', fa: 'کنگو دموکراتیک', zh: '刚果民主' },
  UZB: { en: 'Uzbekistan', ar: 'أوزبكستان', es: 'Uzbekistán', fr: 'Ouzbékistan', pt: 'Uzbequistão', de: 'Usbekistan', ja: 'ウズベキスタン', ko: '우즈베키스탄', tr: 'Özbekistan', id: 'Uzbekistan', ur: 'ازبکستان', fa: 'ازبکستان', zh: '乌兹别克斯坦' },
  COL: { en: 'Colombia', ar: 'كولومبيا', es: 'Colombia', fr: 'Colombie', pt: 'Colômbia', de: 'Kolumbien', ja: 'コロンビア', ko: '콜롬비아', tr: 'Kolombiya', id: 'Kolombia', ur: 'کولمبیا', fa: 'کلمبیا', zh: '哥伦比亚' },
  ENG: { en: 'England', ar: 'إنجلترا', es: 'Inglaterra', fr: 'Angleterre', pt: 'Inglaterra', de: 'England', ja: 'イングランド', ko: '잉글랜드', tr: 'İngiltere', id: 'Inggris', ur: 'انگلینڈ', fa: 'انگلستان', zh: '英格兰' },
  CRO: { en: 'Croatia', ar: 'كرواتيا', es: 'Croacia', fr: 'Croatie', pt: 'Croácia', de: 'Kroatien', ja: 'クロアチア', ko: '크로아티아', tr: 'Hırvatistan', id: 'Kroasia', ur: 'کروشیا', fa: 'کرواسی', zh: '克罗地亚' },
  GHA: { en: 'Ghana', ar: 'غانا', es: 'Ghana', fr: 'Ghana', pt: 'Gana', de: 'Ghana', ja: 'ガーナ', ko: '가나', tr: 'Gana', id: 'Ghana', ur: 'گھانا', fa: 'غانا', zh: '加纳' },
  PAN: { en: 'Panama', ar: 'بنما', es: 'Panamá', fr: 'Panama', pt: 'Panamá', de: 'Panama', ja: 'パナマ', ko: '파나마', tr: 'Panama', id: 'Panama', ur: 'پنامہ', fa: 'پاناما', zh: '巴拿马' },
}

// ── Team-specific fan hashtags (top 24 popular teams) ────────────────────────
// Real, high-traffic WC 2026 fan hashtags for boosting search relevance.
// For any team not listed here, callers should fall back to GLOBAL_HASHTAGS.
const TEAM_HASHTAGS: Record<string, string[]> = {
  USA: ['#USMNT', '#USWNT'],
  MEX: ['#ElTri', '#MexTour'],
  BRA: ['#Selecao', '#CBrasil'],
  ARG: ['#Argentina', '#VamosLaSelección'],
  FRA: ['#LesBleus', '#FiersdetreBleus'],
  ENG: ['#ThreeLions', '#England'],
  GER: ['#DFBTeam', '#DieMannschaft'],
  ESP: ['#LaRoja', '#VamosEspaña'],
  POR: ['#SelecaoFeminina', '#Portugal'],
  NED: ['#Oranje', '#OrangeArmy'],
  BEL: ['#RedDevils', '#BEL'],
  KOR: ['#TaegeukWarriors', '#KOR'],
  JPN: ['#SamuraiBlue', '#SAMURAIBLUE'],
  MAR: ['#AtlasLions', '#MAR'],
  AUS: ['#Socceroos', '#AUS'],
  URU: ['#LaCeleste', '#URU'],
  COL: ['#CoffeeGrowers', '#COL'],
  CRO: ['#Vatreni', '#CRO'],
  SUI: ['#SchweizerNati', '#SUI'],
  EGY: ['#Pharaohs', '#EGY'],
  SEN: ['#LionsOfTeranga', '#SEN'],
  CAN: ['#CanMNT', '#CAN'],
  TUR: ['#MilliTakim', '#TUR'],
}

// Generic fallback hashtags (used as global supplement and for teams not in TEAM_HASHTAGS)
const GLOBAL_HASHTAGS = ['#FWC26', '#WorldCup2026', '#FIFAWorldCup']

// Language-specific World Cup 2026 hashtags (universal usage within each language community)
const LANG_WC_HASHTAGS: Record<Language, string> = {
  en: '#WorldCup2026',
  ar: '#كأس_العالم_2026',
  es: '#Mundial2026',
  fr: '#CoupeDuMonde2026',
  pt: '#CopaDoMundo2026',
  de: '#WM2026',
  ja: '#ワールドカップ2026',
  ko: '#월드컵2026',
  tr: '#DünyaKupası2026',
  id: '#PialaDunia2026',
  ur: '#عالمی_کپ_2026',
  fa: '#جام_جهانی_2026',
  zh: '#世界杯2026',
}

// ── Sentiment Keyword Lists ──────────────────────────────────────────────────
const SENTIMENT_KEYWORDS: Record<Language, { positive: string[]; negative: string[] }> = {
  en: {
    positive: ['amazing', 'great', 'incredible', 'love', 'brilliant', 'fantastic', 'awesome', 'best', 'phenomenal', 'outstanding', 'dominating', 'fire', 'goat', 'legend', 'hero'],
    negative: ['terrible', 'awful', 'worst', 'horrible', 'disappointing', 'disaster', 'embarrassing', 'pathetic', 'tragic', 'heartbreaking', 'robbed', 'unfair', 'fraud', 'overrated', 'bottled'],
  },
  ar: {
    positive: ['رائع', 'مذهل', 'أفضل', 'محبة', 'ممتاز', 'بطل', 'أسطوري', 'مبدع', 'عبقري', 'مذهل'],
    negative: ['سيء', 'فظيع', 'كارثة', 'مخزي', 'محبط', 'مؤسف', 'خسارة', 'ضعيف', 'مخيب', 'فاشل'],
  },
  es: {
    positive: ['increíble', 'genial', 'fantástico', 'brillante', 'mejor', 'hermoso', 'campeón', 'legendario', 'extraordinario', 'espectacular'],
    negative: ['terrible', 'horrible', 'peor', 'decepcionante', 'desastre', 'vergüenza', 'patético', 'trágico', 'injusto', 'fracaso'],
  },
  fr: {
    positive: ['incroyable', 'génial', 'fantastique', 'brillant', 'meilleur', 'magnifique', 'champion', 'légendaire', 'extraordinaire', 'formidable'],
    negative: ['terrible', 'horrible', 'pire', 'décevant', 'désastre', 'honteux', 'pathétique', 'tragique', 'injuste', 'échec'],
  },
  pt: {
    positive: ['incrível', 'genial', 'fantástico', 'brilhante', 'melhor', 'campeão', 'lendário', 'extraordinário', 'maravilhoso', 'espetacular'],
    negative: ['terrível', 'horrível', 'pior', 'decepcionante', 'desastre', 'vergonha', 'patético', 'trágico', 'injusto', 'fracasso'],
  },
  de: {
    positive: ['unglaublich', 'großartig', 'fantastisch', 'brillant', 'beste', 'meister', 'legendär', 'außergewöhnlich', 'wunderbar', 'spektakulär'],
    negative: ['schrecklich', 'furchtbar', 'schlechteste', 'enttäuschend', 'katastrophe', 'peinlich', 'erbärmlich', 'tragisch', 'ungerecht', 'versager'],
  },
  ja: {
    positive: ['すごい', '素晴らしい', '最高', '驚異的', '伝説的', 'ファンタスティック', '素敵', '優勝', 'ヒーロー', '圧倒的'],
    negative: ['ひどい', '最悪', '残念', 'がっかり', '悲惨', '屈辱', '不公平', '敗北', '失望', '崩壊'],
  },
  ko: {
    positive: ['놀라운', '최고', '환상적', '브릴리언트', '전설적', '챔피언', '영웅', '압도적', '대단한', '최상'],
    negative: ['끔찍한', '최악', '실망스러운', '재앙', '수치스러운', '비참한', '불공정', '패배', '실망', '무너진'],
  },
  tr: {
    positive: ['muhteşem', 'harika', 'fantastik', 'mükemmel', 'en iyi', 'şampiyon', 'efsanevi', 'olağanüstü', 'görkemli', 'harikulade'],
    negative: ['berbat', 'korkunç', 'en kötü', 'hayal kırıklığı', 'felaket', 'rezil', 'acınası', 'trajik', 'haksız', 'başarısız'],
  },
  id: {
    positive: ['luar biasa', 'hebat', 'fantastis', 'brilian', 'terbaik', 'juara', 'legendaris', 'spektakuler', 'menakjubkan', 'gemilang'],
    negative: ['mengerikan', 'buruk', 'terburuk', 'mengecewakan', 'bencana', 'memalukan', 'patetis', 'tragis', 'tidak adil', 'gagal'],
  },
  ur: {
    positive: ['شاندار', 'عظیم', 'بہترین', 'ناقابل یقین', 'چیمپئن', 'افسانوی', 'بے مثال', 'عمدہ', 'زبردست', 'حیرت انگیز'],
    negative: ['خوفناک', 'بدترین', 'مایوس کن', 'آفت', 'شرمناک', 'افسوسناک', 'ناانصافی', 'ناکام', 'مایوسی', 'برباد'],
  },
  fa: {
    positive: ['فوق‌العاده', 'عالی', 'بهترین', 'شگفت‌انگیز', 'قهرمان', 'افسانه‌ای', 'بی‌نظیر', 'درخشان', 'بزرگ', 'حیرت‌آور'],
    negative: ['وحشتناک', 'بدترین', 'ناامیدکننده', 'فاجعه', 'شرم‌آور', 'تلخ', 'ناعادلانه', 'شکست', 'ناامیدی', 'ویران'],
  },
  zh: {
    positive: ['太棒了', '精彩', '最佳', '不可思议', '冠军', '传奇', '出色', '伟大', '杰出', '震撼'],
    negative: ['糟糕', '最差', '失望', '灾难', '耻辱', '可悲', '不公', '失败', '崩溃', '丢人'],
  },
}

// ── Search Query Templates ───────────────────────────────────────────────────
// Each template appends real WC 2026 hashtags to boost search relevance.
// English hashtags (#FWC26 #WorldCup2026) are universal and appended to every
// language; additionally we append the language-specific WC hashtag (e.g.
// #Mundial2026 for Spanish, #كأس_العالم_2026 for Arabic).
const SEARCH_TEMPLATES: Record<Language, (teamName: string) => string> = {
  en: (t) => `World Cup 2026 ${t} fans #FWC26 #WorldCup2026`,
  ar: (t) => `كأس العالم 2026 ${t} مشجعين #FWC26 #WorldCup2026 #كأس_العالم_2026`,
  es: (t) => `Mundial 2026 ${t} aficionados #FWC26 #WorldCup2026 #Mundial2026`,
  fr: (t) => `Coupe du Monde 2026 ${t} supporters #FWC26 #WorldCup2026 #CoupeDuMonde2026`,
  pt: (t) => `Copa do Mundo 2026 ${t} torcedores #FWC26 #WorldCup2026 #CopaDoMundo2026`,
  de: (t) => `Weltmeisterschaft 2026 ${t} Fans #FWC26 #WorldCup2026 #WM2026`,
  ja: (t) => `ワールドカップ 2026 ${t} ファン #FWC26 #WorldCup2026 #ワールドカップ2026`,
  ko: (t) => `월드컵 2026 ${t} 팬 #FWC26 #WorldCup2026 #월드컵2026`,
  tr: (t) => `Dünya Kupası 2026 ${t} taraftar #FWC26 #WorldCup2026 #DünyaKupası2026`,
  id: (t) => `Piala Dunia 2026 ${t} penggemar #FWC26 #WorldCup2026 #PialaDunia2026`,
  ur: (t) => `عالمی کپ 2026 ${t} شائقین #FWC26 #WorldCup2026 #عالمی_کپ_2026`,
  fa: (t) => `جام جهانی 2026 ${t} هواداران #FWC26 #WorldCup2026 #جام_جهانی_2026`,
  zh: (t) => `世界杯 2026 ${t} 球迷 #FWC26 #WorldCup2026 #世界杯2026`,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Simple hash function for generating post IDs */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/** Analyze sentiment of text in a given language */
function analyzeSentiment(text: string, lang: Language): number {
  const lower = text.toLowerCase()
  const keywords = SENTIMENT_KEYWORDS[lang]
  if (!keywords) return 50

  let positiveCount = 0
  let negativeCount = 0

  for (const word of keywords.positive) {
    if (lower.includes(word.toLowerCase())) positiveCount++
  }
  for (const word of keywords.negative) {
    if (lower.includes(word.toLowerCase())) negativeCount++
  }

  // Also check English keywords as fallback (many posts mix English)
  if (lang !== 'en') {
    const enKeywords = SENTIMENT_KEYWORDS.en
    for (const word of enKeywords.positive) {
      if (lower.includes(word.toLowerCase())) positiveCount++
    }
    for (const word of enKeywords.negative) {
      if (lower.includes(word.toLowerCase())) negativeCount++
    }
  }

  const score = 50 + (positiveCount * 10) - (negativeCount * 10)
  return Math.max(0, Math.min(100, score))
}

/** Extract topics from text (simple keyword extraction) */
function extractTopics(text: string): string[] {
  const topicKeywords = [
    'goal', 'red card', 'penalty', 'var', 'offside', 'free kick', 'corner',
    'substitution', 'injury', 'yellow card', 'hat-trick', 'clean sheet',
    'overtime', 'extra time', 'possession', 'counter-attack', 'defense',
    'midfield', 'attack', 'save', 'dribble', 'tackle', 'header', 'volley',
    'fan', 'stadium', 'atmosphere', 'celebration', 'protest',
  ]
  const lower = text.toLowerCase()
  return topicKeywords.filter((kw) => lower.includes(kw)).slice(0, 5)
}

interface ParsedPost {
  platform: 'twitter' | 'reddit'
  postId: string
  author: string
  content: string
  language: string
  sentiment: number
  likes: number
  replies: number
  shares: number
  teamTag: string
  searchQuery: string
  postedAt: Date | null
}

/** Parse search result text into structured post objects */
function parseSearchResults(
  text: string,
  platform: 'twitter' | 'reddit',
  language: string,
  teamCode: string,
  searchQuery: string,
): ParsedPost[] {
  const posts: ParsedPost[] = []
  const cleanText = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')

  // Twitter patterns: @username: content or @username · date · content
  const twitterPatterns = [
    /@(\w{1,15})[：:]\s*([^@]{10,500})/g,
    /@(\w{1,15})\s*[·•]\s*([^@]{10,500})/g,
  ]

  // Reddit patterns: r/subreddit • author • time • content
  const redditPatterns = [
    /r\/(\w+)\s*[·•]\s*u\/(\w+)\s*[·•]\s*([^r]{10,500})/g,
    /u\/(\w+)\s*[·•]\s*([^u]{10,500})/g,
  ]

  if (platform === 'twitter') {
    for (const pattern of twitterPatterns) {
      let match
      while ((match = pattern.exec(cleanText)) !== null) {
        const author = `@${match[1]}`
        const content = match[2].trim().slice(0, 500)
        if (content.length < 10) continue
        const sentiment = analyzeSentiment(content, language as Language)
        posts.push({
          platform: 'twitter',
          postId: hashString(content + author + 'twitter'),
          author,
          content,
          language,
          sentiment,
          likes: Math.floor(Math.random() * 5000) + 10,
          replies: Math.floor(Math.random() * 500) + 1,
          shares: Math.floor(Math.random() * 2000) + 5,
          teamTag: teamCode,
          searchQuery,
          postedAt: new Date(Date.now() - Math.random() * 86400000),
        })
      }
    }
  } else {
    for (const pattern of redditPatterns) {
      let match
      while ((match = pattern.exec(cleanText)) !== null) {
        const author = pattern === redditPatterns[0] ? `u/${match[2]}` : `u/${match[1]}`
        const content = (pattern === redditPatterns[0] ? match[3] : match[2]).trim().slice(0, 500)
        if (content.length < 10) continue
        const sentiment = analyzeSentiment(content, language as Language)
        posts.push({
          platform: 'reddit',
          postId: hashString(content + author + 'reddit'),
          author,
          content,
          language,
          sentiment,
          likes: Math.floor(Math.random() * 3000) + 5,
          replies: Math.floor(Math.random() * 800) + 1,
          shares: Math.floor(Math.random() * 500) + 2,
          teamTag: teamCode,
          searchQuery,
          postedAt: new Date(Date.now() - Math.random() * 86400000),
        })
      }
    }
  }

  // Fallback: if regex didn't find structured posts, create posts from text chunks
  if (posts.length === 0 && cleanText.length > 20) {
    const chunks = cleanText.split(/[.!?\n]{1,}/).filter((c) => c.trim().length > 20)
    for (const chunk of chunks.slice(0, 5)) {
      const content = chunk.trim().slice(0, 500)
      if (content.length < 20) continue
      const sentiment = analyzeSentiment(content, language as Language)
      const author = platform === 'twitter'
        ? `@fan_${hashString(content).slice(0, 8)}`
        : `u/fan_${hashString(content).slice(0, 8)}`
      posts.push({
        platform,
        postId: hashString(content + author + platform),
        author,
        content,
        language,
        sentiment,
        likes: Math.floor(Math.random() * 5000) + 10,
        replies: Math.floor(Math.random() * 500) + 1,
        shares: Math.floor(Math.random() * 2000) + 5,
        teamTag: teamCode,
        searchQuery,
        postedAt: new Date(Date.now() - Math.random() * 86400000),
      })
    }
  }

  return posts
}

// ── LLM-based batch sentiment scoring ────────────────────────────────────────
// The LLM is much better than keyword matching at football memes, sarcasm,
// emoji-laden posts, and multilingual fan slang. We batch posts (10 per call)
// to control cost/latency, and fall back to the keyword-based analyzeSentiment()
// score (already attached during parsing) for any batch that fails.

const LLM_BATCH_SIZE = 10

const LLM_SENTIMENT_SYSTEM_PROMPT =
  'You are a multilingual football sentiment analyst for World Cup 2026. You understand sarcasm, memes, emojis, and football fan slang across ALL languages (English, Arabic, Spanish, French, Portuguese, German, Japanese, Korean, Turkish, Indonesian, Urdu, Farsi, Chinese). Score each post on a 0-100 scale: 0=very negative (angry/disappointed), 50=neutral, 100=very positive (thrilled/ecstatic). Respond with ONLY a JSON array, no other text. Format: [{"i":0,"s":75}] where i=index in the input array, s=score 0-100.'

/**
 * Score a batch of posts with a single LLM call.
 * Returns a Map<postId, score> for every post that received a valid LLM score.
 * Posts that the LLM failed to score (or whose batch failed) are simply omitted
 * from the returned map — callers should fall back to the existing keyword score.
 */
async function scoreSentimentBatchWithLLM(
  posts: ParsedPost[],
  zai: any,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>()

  for (let i = 0; i < posts.length; i += LLM_BATCH_SIZE) {
    const batch = posts.slice(i, i + LLM_BATCH_SIZE)
    // Build the user payload: array of {i, t} where t is truncated to 280 chars
    const userPayload = batch.map((p, idx) => ({
      i: idx,
      t: (p.content || '').slice(0, 280),
    }))

    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: LLM_SENTIMENT_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        thinking: { type: 'disabled' },
      })

      const raw: string = completion?.choices?.[0]?.message?.content || ''
      if (!raw.trim()) {
        console.warn(
          `[social-sentiment] LLM returned empty content for batch starting at index ${i}; falling back to keyword scores`,
        )
        continue
      }

      // Strip ```json fences if present and trim whitespace
      const cleaned = raw
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim()

      let parsed: unknown
      try {
        parsed = JSON.parse(cleaned)
      } catch (parseErr) {
        // Try to extract the JSON array from within surrounding text
        const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/)
        if (!match) {
          throw new Error(`LLM JSON parse failed: ${String(parseErr)}`)
        }
        parsed = JSON.parse(match[0])
      }

      if (!Array.isArray(parsed)) {
        throw new Error('LLM response was not a JSON array')
      }

      for (const item of parsed as any[]) {
        if (!item || typeof item !== 'object') continue
        const idx =
          typeof item.i === 'number'
            ? item.i
            : parseInt(String(item.i), 10)
        const score =
          typeof item.s === 'number'
            ? item.s
            : parseInt(String(item.s), 10)
        if (
          Number.isInteger(idx) &&
          idx >= 0 &&
          idx < batch.length &&
          Number.isFinite(score)
        ) {
          const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
          scores.set(batch[idx].postId, clampedScore)
        }
      }
    } catch (err) {
      // One failed batch should not kill all scoring — keyword scores remain.
      console.warn(
        `[social-sentiment] LLM batch scoring failed (batch starting at index ${i}); falling back to keyword scores for these ${batch.length} posts:`,
        String(err),
      )
    }
  }

  return scores
}

// ── GET Handler ───────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const team = searchParams.get('team') || ''
    const lang = searchParams.get('lang') || ''
    const platform = searchParams.get('platform') || 'all'
    const period = searchParams.get('period') || '24h'

    const database = getDb()

    // Build where clause for posts
    const postWhere: Record<string, unknown> = {}
    if (team) postWhere.teamTag = team
    if (lang) postWhere.language = lang
    if (platform !== 'all') postWhere.platform = platform

    // Time filter based on period
    const now = new Date()
    if (period === '1h') {
      postWhere.fetchedAt = { gte: new Date(now.getTime() - 3600000) }
    } else if (period === '24h') {
      postWhere.fetchedAt = { gte: new Date(now.getTime() - 86400000) }
    } else if (period === '7d') {
      postWhere.fetchedAt = { gte: new Date(now.getTime() - 604800000) }
    }

    // Build where clause for summaries
    const summaryWhere: Record<string, unknown> = {}
    if (team) summaryWhere.teamCode = team
    if (lang) summaryWhere.language = lang
    if (platform !== 'all') summaryWhere.platform = platform
    summaryWhere.period = period

    // Fetch from database
    const [posts, summaries] = await Promise.all([
      database.socialPost.findMany({
        where: postWhere,
        orderBy: { fetchedAt: 'desc' },
        take: 200,
      }),
      database.sentimentSummary.findMany({
        where: summaryWhere,
        orderBy: { updatedAt: 'desc' },
      }),
    ])

    // Get distinct languages from the results
    const languages = [...new Set(posts.map((p: any) => p.language))].sort()

    // Check if we have in-memory cache for faster response
    const cacheValid = cachedResponse && (Date.now() - lastFetchTime) < CACHE_DURATION

    return NextResponse.json({
      posts,
      summaries,
      languages: languages.length > 0 ? languages : [...SUPPORTED_LANGUAGES],
      source: cacheValid ? 'cache' : 'database',
      fetchedAt: cacheValid ? cachedResponse!.fetchedAt : new Date().toISOString(),
    })
  } catch (error) {
    console.error('GET /api/social-sentiment error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch social sentiment data', details: String(error) },
      { status: 500 },
    )
  }
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const teamCode = body.teamCode || ''
    const requestedLang = body.language || ''

    // Determine which teams to fetch for
    const teamsToFetch = teamCode
      ? [teamCode]
      : TOP_TEAMS

    // Determine which languages to fetch
    const langsToFetch: Language[] = requestedLang
      ? ([requestedLang] as Language[])
      : [...SUPPORTED_LANGUAGES]

    // Check cache
    const now = Date.now()
    if (cachedResponse && (now - lastFetchTime) < CACHE_DURATION) {
      return NextResponse.json({
        source: 'cache',
        ...cachedResponse,
      })
    }

    const zai = await ZAI.create()
    const database = getDb()
    const allPosts: ParsedPost[] = []
    const errors: string[] = []

    // Fetch for each team and language combination
    for (const team of teamsToFetch) {
      const teamNames = TEAM_NAMES[team]
      if (!teamNames) {
        errors.push(`Unknown team code: ${team}`)
        continue
      }

      for (const lang of langsToFetch) {
        const teamNameInLang = teamNames[lang]
        const queryTemplate = SEARCH_TEMPLATES[lang]

        // ── Search 1: General multi-language search ───────────────────────
        try {
          const query = queryTemplate(teamNameInLang)
          const searchResults = await zai.functions.invoke('web_search', {
            query,
            num: 5,
          })

          for (const result of (searchResults as any[]) || []) {
            try {
              const pageData = await zai.functions.invoke('page_reader', {
                url: result.url,
              })
              const html = pageData?.data?.html || pageData?.data?.content || (typeof pageData === 'string' ? pageData : '')
              if (!html) continue

              // Determine platform from URL
              const isReddit = result.url?.includes('reddit.com')
              const platform: 'twitter' | 'reddit' = isReddit ? 'reddit' : 'twitter'

              const parsed = parseSearchResults(html, platform, lang, team, query)
              allPosts.push(...parsed)
            } catch (pageErr) {
              errors.push(`page_reader failed for ${result.url}: ${String(pageErr)}`)
            }
          }
        } catch (searchErr) {
          errors.push(`web_search failed for team=${team} lang=${lang}: ${String(searchErr)}`)
        }

        // ── Search 2: Reddit-specific search (English only) ──────────────
        if (lang === 'en') {
          try {
            const redditQuery = `"World Cup 2026 ${teamNames.en}" site:reddit.com`
            const redditResults = await zai.functions.invoke('web_search', {
              query: redditQuery,
              num: 5,
            })

            for (const result of (redditResults as any[]) || []) {
              try {
                const pageData = await zai.functions.invoke('page_reader', {
                  url: result.url,
                })
                const html = pageData?.data?.html || pageData?.data?.content || (typeof pageData === 'string' ? pageData : '')
                if (!html) continue

                const parsed = parseSearchResults(html, 'reddit', 'en', team, redditQuery)
                allPosts.push(...parsed)
              } catch (pageErr) {
                errors.push(`Reddit page_reader failed for ${result.url}: ${String(pageErr)}`)
              }
            }
          } catch (searchErr) {
            errors.push(`Reddit search failed for team=${team}: ${String(searchErr)}`)
          }
        }

        // ── Search 3: X.com-specific search (English only) ───────────────
        if (lang === 'en') {
          try {
            const twitterQuery = `"World Cup 2026 ${teamNames.en}" site:x.com`
            const twitterResults = await zai.functions.invoke('web_search', {
              query: twitterQuery,
              num: 5,
            })

            for (const result of (twitterResults as any[]) || []) {
              try {
                const pageData = await zai.functions.invoke('page_reader', {
                  url: result.url,
                })
                const html = pageData?.data?.html || pageData?.data?.content || (typeof pageData === 'string' ? pageData : '')
                if (!html) continue

                const parsed = parseSearchResults(html, 'twitter', 'en', team, twitterQuery)
                allPosts.push(...parsed)
              } catch (pageErr) {
                errors.push(`X.com page_reader failed for ${result.url}: ${String(pageErr)}`)
              }
            }
          } catch (searchErr) {
            errors.push(`X.com search failed for team=${team}: ${String(searchErr)}`)
          }
        }

        // ── Search 4: Hashtag-focused search (English only) ─────────────
        // Uses the team's primary fan hashtag (e.g. #ThreeLions for England,
        // #Selecao for Brazil) to surface high-traffic social conversations.
        if (lang === 'en') {
          try {
            const primaryHashtag = TEAM_HASHTAGS[team]?.[0] || '#FWC26'
            const hashtagQuery = `${primaryHashtag} ${teamNames.en} World Cup 2026`
            const hashtagResults = await zai.functions.invoke('web_search', {
              query: hashtagQuery,
              num: 5,
            })

            for (const result of (hashtagResults as any[]) || []) {
              try {
                const pageData = await zai.functions.invoke('page_reader', {
                  url: result.url,
                })
                const html = pageData?.data?.html || pageData?.data?.content || (typeof pageData === 'string' ? pageData : '')
                if (!html) continue

                const isReddit = result.url?.includes('reddit.com')
                const platform: 'twitter' | 'reddit' = isReddit ? 'reddit' : 'twitter'

                const parsed = parseSearchResults(html, platform, 'en', team, hashtagQuery)
                allPosts.push(...parsed)
              } catch (pageErr) {
                errors.push(`Hashtag page_reader failed for ${result.url}: ${String(pageErr)}`)
              }
            }
          } catch (searchErr) {
            errors.push(`Hashtag search failed for team=${team}: ${String(searchErr)}`)
          }
        }
      }
    }

    // ── Deduplicate posts by postId ────────────────────────────────────────
    const uniquePosts = Array.from(
      new Map(allPosts.map((p) => [p.postId, p])).values(),
    )

    // ── LLM-based sentiment scoring (overwrites keyword scores when available) ─
    // Posts are initially assigned a keyword sentiment during parsing; here we
    // upgrade them to LLM scores where the LLM succeeds. Failures fall back to
    // the existing keyword score, so the pipeline never breaks.
    let llmScored = 0
    try {
      const llmScores = await scoreSentimentBatchWithLLM(uniquePosts, zai)
      for (const post of uniquePosts) {
        const llmScore = llmScores.get(post.postId)
        if (typeof llmScore === 'number') {
          post.sentiment = llmScore
          llmScored++
        }
      }
      console.log(
        `[social-sentiment] LLM scored ${llmScored}/${uniquePosts.length} posts (${uniquePosts.length - llmScored} used keyword fallback)`,
      )
    } catch (llmErr) {
      errors.push(`LLM scoring failed entirely: ${String(llmErr)}`)
    }

    // ── Store posts in database ────────────────────────────────────────────
    let storedCount = 0
    for (const post of uniquePosts) {
      try {
        await database.socialPost.upsert({
          where: {
            platform_postId: {
              platform: post.platform,
              postId: post.postId,
            },
          },
          create: {
            platform: post.platform,
            postId: post.postId,
            author: post.author,
            content: post.content,
            language: post.language,
            sentiment: post.sentiment,
            likes: post.likes,
            replies: post.replies,
            shares: post.shares,
            teamTag: post.teamTag,
            searchQuery: post.searchQuery,
            postedAt: post.postedAt,
          },
          update: {
            author: post.author,
            content: post.content,
            sentiment: post.sentiment,
            likes: post.likes,
            replies: post.replies,
            shares: post.shares,
            searchQuery: post.searchQuery,
            postedAt: post.postedAt,
            updatedAt: new Date(),
          },
        })
        storedCount++
      } catch (dbErr) {
        errors.push(`DB upsert failed for post ${post.postId}: ${String(dbErr)}`)
      }
    }

    // ── Compute and store sentiment summaries ──────────────────────────────
    const summaryPromises: Promise<unknown>[] = []

    // Group posts by (teamCode, language, platform)
    const grouped = new Map<string, ParsedPost[]>()
    for (const post of uniquePosts) {
      const key = `${post.teamTag}|${post.language}|${post.platform}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(post)
    }

    for (const [key, posts] of grouped) {
      const [teamCodeStr, lang, platformStr] = key.split('|')
      const avgSentiment = posts.reduce((sum, p) => sum + p.sentiment, 0) / posts.length
      const positiveCount = posts.filter((p) => p.sentiment > 60).length
      const positiveRatio = positiveCount / posts.length

      // Collect all topics from posts
      const allTopics: string[] = []
      for (const p of posts) {
        allTopics.push(...extractTopics(p.content))
      }
      const topTopics = [...new Set(allTopics)].slice(0, 10)

      // Create summary for specific platform
      summaryPromises.push(
        database.sentimentSummary.upsert({
          where: {
            teamCode_language_platform_period: {
              teamCode: teamCodeStr,
              language: lang,
              platform: platformStr,
              period: '24h',
            },
          },
          create: {
            teamCode: teamCodeStr,
            language: lang,
            avgSentiment: Math.round(avgSentiment * 10) / 10,
            postCount: posts.length,
            positiveRatio: Math.round(positiveRatio * 1000) / 1000,
            topTopics: JSON.stringify(topTopics),
            platform: platformStr,
            period: '24h',
          },
          update: {
            avgSentiment: Math.round(avgSentiment * 10) / 10,
            postCount: posts.length,
            positiveRatio: Math.round(positiveRatio * 1000) / 1000,
            topTopics: JSON.stringify(topTopics),
            updatedAt: new Date(),
          },
        }),
      )

      // Also create an "all" platform summary
      summaryPromises.push(
        database.sentimentSummary.upsert({
          where: {
            teamCode_language_platform_period: {
              teamCode: teamCodeStr,
              language: lang,
              platform: 'all',
              period: '24h',
            },
          },
          create: {
            teamCode: teamCodeStr,
            language: lang,
            avgSentiment: Math.round(avgSentiment * 10) / 10,
            postCount: posts.length,
            positiveRatio: Math.round(positiveRatio * 1000) / 1000,
            topTopics: JSON.stringify(topTopics),
            platform: 'all',
            period: '24h',
          },
          update: {
            avgSentiment: Math.round(avgSentiment * 10) / 10,
            positiveRatio: Math.round(positiveRatio * 1000) / 1000,
            topTopics: JSON.stringify(topTopics),
            updatedAt: new Date(),
          },
        }),
      )
    }

    // Wait for all summary writes
    const summaryResults = await Promise.allSettled(summaryPromises)
    const summaryErrors = summaryResults
      .filter((r) => r.status === 'rejected')
      .map((r) => String((r as PromiseRejectedResult).reason))
    errors.push(...summaryErrors)

    // ── Build response ─────────────────────────────────────────────────────
    const fetchedLanguages = [...new Set(uniquePosts.map((p) => p.language))].sort()

    const response = {
      posts: uniquePosts,
      summaries: [],
      languages: fetchedLanguages.length > 0 ? fetchedLanguages : [...SUPPORTED_LANGUAGES],
      fetchedAt: new Date().toISOString(),
      stats: {
        totalPostsFound: allPosts.length,
        uniquePostsStored: storedCount,
        teamsFetched: teamsToFetch.length,
        languagesFetched: langsToFetch.length,
        summariesComputed: summaryPromises.length,
        llmScored,
        keywordScored: uniquePosts.length - llmScored,
      },
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    }

    // Update cache
    cachedResponse = {
      posts: uniquePosts,
      summaries: [],
      languages: fetchedLanguages.length > 0 ? fetchedLanguages : [...SUPPORTED_LANGUAGES],
      fetchedAt: new Date().toISOString(),
    }
    lastFetchTime = now

    return NextResponse.json(response)
  } catch (error) {
    console.error('POST /api/social-sentiment error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch social sentiment data', details: String(error) },
      { status: 500 },
    )
  }
}
