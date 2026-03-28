export type AptNation = 'Russia' | 'China' | 'North Korea' | 'Iran' | 'USA' | 'Criminal';
export type AptCategory = 'nation-state' | 'criminal' | 'hacktivism';

export interface AptProfile {
  id: string;
  name: string;
  aliases: string[];
  nation: AptNation;
  active: string;
  category: AptCategory;
  specialty: string[];
  color: string;
  flagEmoji: string;
  notableBreachIds: string[];
  description: string;
  motivation: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export const aptProfiles: AptProfile[] = [
  {
    id: 'apt28',
    name: 'APT28',
    aliases: ['Fancy Bear', 'Sofacy', 'Pawn Storm', 'Sednit', 'STRONTIUM'],
    nation: 'Russia',
    active: '2004 – günümüz',
    category: 'nation-state',
    specialty: ['Spear Phishing', 'Zero-Day Exploits', 'Credential Harvesting', 'Disinformation'],
    color: '#ef4444',
    flagEmoji: '🇷🇺',
    notableBreachIds: ['apt28-turkey-2016', 'estonia-2007'],
    description: 'Rus GRU askeri istihbaratına bağlı, dünya\'nın en aktif ve tehlikeli APT gruplarından biri. NATO üyesi ülkeleri, seçim süreçlerini ve savunma sanayiini hedef alır.',
    motivation: 'Siyasi istihbarat, dezenformasyon, NATO karşı operasyonları',
    riskLevel: 'CRITICAL',
  },
  {
    id: 'apt29',
    name: 'APT29',
    aliases: ['Cozy Bear', 'The Dukes', 'NOBELIUM', 'Midnight Blizzard'],
    nation: 'Russia',
    active: '2008 – günümüz',
    category: 'nation-state',
    specialty: ['Supply Chain Attacks', 'Cloud Exploitation', 'Living off the Land', 'OAuth Abuse'],
    color: '#f97316',
    flagEmoji: '🇷🇺',
    notableBreachIds: ['solarwinds-2020', 'buckshot-yankee-2008'],
    description: 'Rus SVR dış istihbarat servisine bağlı, son derece sofistike ve sabırlı bir tehdit aktörü. SolarWinds saldırısının arkasındaki grup olarak tanınır. Tespit edilmekten kaçınma konusunda olağanüstü yeteneklidir.',
    motivation: 'Stratejik uzun vadeli istihbarat toplama, diplomatik hedefler',
    riskLevel: 'CRITICAL',
  },
  {
    id: 'sandworm',
    name: 'Sandworm',
    aliases: ['VOODOO BEAR', 'BlackEnergy', 'Seashell Blizzard', 'Unit 74455'],
    nation: 'Russia',
    active: '2009 – günümüz',
    category: 'nation-state',
    specialty: ['ICS/SCADA Attacks', 'Destructive Malware', 'Power Grid Disruption', 'Wiper Malware'],
    color: '#dc2626',
    flagEmoji: '🇷🇺',
    notableBreachIds: ['shamoon-aramco-2012', 'costa-rica-conti-2022'],
    description: 'GRU\'nun en yıkıcı siber birimi. NotPetya (tarihin en maliyetli siber saldırısı, $10B+) ve Ukrayna elektrik şebekesi saldırılarının arkasındaki grup. Fiziksel altyapıyı hedef alan siber silahlar geliştirir.',
    motivation: 'Fiziksel altyapı tahribatı, jeopolitik baskı',
    riskLevel: 'CRITICAL',
  },
  {
    id: 'lazarus',
    name: 'Lazarus Group',
    aliases: ['Hidden Cobra', 'ZINC', 'Guardians of Peace', 'APT38'],
    nation: 'North Korea',
    active: '2009 – günümüz',
    category: 'nation-state',
    specialty: ['Cryptocurrency Theft', 'Financial Heists', 'Ransomware', 'Supply Chain'],
    color: '#8b5cf6',
    flagEmoji: '🇰🇵',
    notableBreachIds: ['ronin-network-2022', 'sony-psn-2011'],
    description: 'Kuzey Kore Genel Keşif Bürosu\'na bağlı, finansal motivasyonlu devlet destekli grup. Crypto hırsızlığı ve banka soygunu konusunda uzmanlaşmış. Ronin Network\'ten $620M çalmalarıyla kripto tarihinin en büyük soygununun failleri.',
    motivation: 'Yaptırımları aşmak için döviz geliri üretme, rejim finansmanı',
    riskLevel: 'CRITICAL',
  },
  {
    id: 'apt41',
    name: 'APT41',
    aliases: ['Double Dragon', 'Winnti', 'Barium', 'Wicked Panda'],
    nation: 'China',
    active: '2012 – günümüz',
    category: 'nation-state',
    specialty: ['Dual Espionage', 'Supply Chain', 'Gaming Industry', 'Healthcare Data'],
    color: '#f59e0b',
    flagEmoji: '🇨🇳',
    notableBreachIds: ['rsa-securid-2011', 't-mobile-2021'],
    description: 'Hem devlet istihbaratı hem de finansal çıkar için faaliyet gösteren nadir bir hibrit APT. MSS (Çin Devlet Güvenlik Bakanlığı) adına çalışırken aynı zamanda oyun sektörünü kripto hırsızlığı için hedef alır.',
    motivation: 'Çin devlet çıkarları + bireysel finansal kazanç',
    riskLevel: 'HIGH',
  },
  {
    id: 'oilrig',
    name: 'OilRig',
    aliases: ['APT34', 'Helix Kitten', 'Crambus', 'Cobalt Gypsy'],
    nation: 'Iran',
    active: '2014 – günümüz',
    category: 'nation-state',
    specialty: ['Middle East Targeting', 'DNS Hijacking', 'Custom Implants', 'Credential Phishing'],
    color: '#22d3ee',
    flagEmoji: '🇮🇷',
    notableBreachIds: ['shamoon-aramco-2012', 'apt28-turkey-2016'],
    description: 'İran İslam Devrimi Muhafızları\'na bağlı olduğu değerlendirilen grup, Orta Doğu enerji sektörü, finans ve telekomünikasyon altyapısını hedef alır. Türkiye de dahil olmak üzere bölge ülkelerini aktif olarak hedef aldığı bilinmektedir.',
    motivation: 'Bölgesel güç projeksiyonu, ekonomik istihbarat, muhalefet takibi',
    riskLevel: 'HIGH',
  },
  {
    id: 'scattered-spider',
    name: 'Scattered Spider',
    aliases: ['UNC5537', 'Starfraud', 'Octo Tempest', '0ktapus'],
    nation: 'Criminal',
    active: '2021 – günümüz',
    category: 'criminal',
    specialty: ['Social Engineering', 'MFA Bypass', 'SIM Swapping', 'Cloud Environments'],
    color: '#a78bfa',
    flagEmoji: '🌐',
    notableBreachIds: ['snowflake-2024', 'mgm-resorts-2023'],
    description: '16-22 yaşları arasındaki İngilizce konuşan gençlerden oluşan gevşek organize bir siber suç örgütü. MGM Resorts\'a $100M+ zarar veren ve Snowflake\'i kullanan 165 kurumu ihlal eden saldırıların faili. Sosyal mühendislik konusunda olağanüstü yetenekli.',
    motivation: 'Finansal kazanç, ün ve saygınlık',
    riskLevel: 'HIGH',
  },
  {
    id: 'revil',
    name: 'REvil / Sodinokibi',
    aliases: ['Gold Southfield', 'Pinchy Spider'],
    nation: 'Criminal',
    active: '2019 – 2022',
    category: 'criminal',
    specialty: ['Ransomware-as-a-Service', 'Double Extortion', 'Supply Chain Ransomware'],
    color: '#fb923c',
    flagEmoji: '🌐',
    notableBreachIds: ['kaseya-vsa-2021', 'colonial-pipeline-2021'],
    description: 'Dünyanın en aktif ve kazançlı ransomware grubu. Kaseya VSA supply chain saldırısıyla 1500+ şirketi aynı anda etkileyen saldırının failleri. Fidye-yazılımı-hizmet (RaaS) modeliyle çalışarak %70 gelir ortaklığı sundu. Rusya\'nın ABD baskısı sonucu 2022\'de bazı üyelerini tutukladığı nadir bir örnek.',
    motivation: 'Fidye ödemeleri yoluyla finansal kazanç',
    riskLevel: 'HIGH',
  },
];
