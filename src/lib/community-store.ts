// In-memory community post store.
// Sunucu yeniden başlatıldığında sıfırlanır.
// Kalıcı topluluk verisi için ileride ortak store adapter katmanına taşınmalı.

export type PostCategory = 'CTF' | 'WEB' | 'PENTEST' | 'MALWARE' | 'OSINT' | 'NETWORK' | 'GENERAL'
export type PostDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface CommunityComment {
  id: string
  author: string
  content: string
  createdAt: string
  likes: string[]
}

export interface CommunityPost {
  id: string
  author: string
  authorRole: string
  title: string
  content: string
  category: PostCategory
  difficulty: PostDifficulty
  tags: string[]
  likes: string[]
  comments: CommunityComment[]
  createdAt: string
  views: number
}

function isoAgo(options: { days?: number; hours?: number }) {
  const days = options.days ?? 0
  const hours = options.hours ?? 0
  return new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString()
}

const SEED_POSTS: CommunityPost[] = [
  {
    id: 'seed1',
    author: 'web_operator',
    authorRole: 'Web Security Researcher',
    title: 'SQL Injection Bulgusunu Güvenli Şekilde Doğrulama',
    content:
      "Bu paylaşımda, bir test ortamında doğrulanan SQL injection bulgusunun nasıl güvenli şekilde raporlandığını anlatıyorum. Amaç, ham payload göstermekten çok etki doğrulaması, risk sınırı ve düzeltme önerisini netleştirmek. Özellikle giriş formu, hata mesajı davranışı ve sorgu ayrıştırma mantığı üzerine odaklandım.",
    category: 'WEB',
    difficulty: 'intermediate',
    tags: ['sql', 'validation', 'reporting'],
    likes: ['member-01', 'member-02', 'member-03'],
    comments: [
      {
        id: 'c1',
        author: 'packet_hunter',
        content: 'Risk çerçevesi ve doğrulama sınırlarını ayırman çok değerli olmuş.',
        createdAt: isoAgo({ hours: 1 }),
        likes: [],
      },
    ],
    createdAt: isoAgo({ days: 2 }),
    views: 142,
  },
  {
    id: 'seed2',
    author: 'ctf_runner',
    authorRole: 'CTF Player',
    title: 'PicoCTF Web Kategorisinde Öğrenilen 3 Temel Ders',
    content:
      "Bu notta PicoCTF web sorularından çıkardığım üç temel dersi topladım: istemci tarafı varsayımlarına güvenmemek, JWT ve session akışlarını birlikte okumak ve SSRF benzeri yüzeylerde hedef davranışını aşamalı doğrulamak. Amaç çözüm dump etmek değil, düşünme biçimini aktarmak.",
    category: 'CTF',
    difficulty: 'beginner',
    tags: ['ctf', 'jwt', 'ssrf', 'learning'],
    likes: ['member-04'],
    comments: [],
    createdAt: isoAgo({ days: 1 }),
    views: 87,
  },
  {
    id: 'seed3',
    author: 'packet_watch',
    authorRole: 'Network Security Engineer',
    title: 'Wireshark ile ARP Zehirlenmesi Sinyallerini Okumak',
    content:
      'Bu kısa rehber, ARP poisoning davranışını Wireshark üzerinde nasıl fark edebileceğinize odaklanıyor. Hedefimiz tek bir filtre ezberlemek değil; paket ritmi, tekrar eden yanıtlar ve anormal eşleşmeler üzerinden olay okuma refleksi kazanmak.',
    category: 'NETWORK',
    difficulty: 'intermediate',
    tags: ['wireshark', 'arp', 'mitm', 'detection'],
    likes: ['member-01', 'member-05'],
    comments: [],
    createdAt: isoAgo({ days: 3 }),
    views: 203,
  },
]

function clonePost(post: CommunityPost): CommunityPost {
  return {
    ...post,
    tags: [...post.tags],
    likes: [...post.likes],
    comments: post.comments.map((comment) => ({
      ...comment,
      likes: [...comment.likes],
    })),
  }
}

function createSeedStore() {
  return SEED_POSTS.map(clonePost)
}

const globalKey = '__community_store__' as const

declare global {
  // eslint-disable-next-line no-var
  var __community_store__: CommunityPost[] | undefined
}

function getStore(): CommunityPost[] {
  if (!global[globalKey]) {
    global[globalKey] = createSeedStore()
  }
  return global[globalKey]!
}

export function listPosts(opts: {
  category?: PostCategory
  difficulty?: PostDifficulty
  sort?: 'newest' | 'popular' | 'views'
  limit?: number
}): CommunityPost[] {
  let posts = getStore().map(clonePost)

  if (opts.category) posts = posts.filter((post) => post.category === opts.category)
  if (opts.difficulty) posts = posts.filter((post) => post.difficulty === opts.difficulty)

  const sort = opts.sort ?? 'newest'
  if (sort === 'newest') posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (sort === 'popular') posts.sort((a, b) => b.likes.length - a.likes.length)
  if (sort === 'views') posts.sort((a, b) => b.views - a.views)

  return posts.slice(0, opts.limit ?? 50)
}

export function createPost(input: {
  author: string
  authorRole: string
  title: string
  content: string
  category: PostCategory
  difficulty: PostDifficulty
  tags: string[]
}): CommunityPost {
  const post: CommunityPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    likes: [],
    comments: [],
    createdAt: new Date().toISOString(),
    views: 0,
  }

  getStore().unshift(post)
  return clonePost(post)
}

export function likePost(id: string, userId: string): CommunityPost | null {
  const post = getStore().find((item) => item.id === id)
  if (!post) return null

  const index = post.likes.indexOf(userId)
  if (index === -1) post.likes.push(userId)
  else post.likes.splice(index, 1)

  return clonePost(post)
}

export function addComment(id: string, author: string, content: string): CommunityPost | null {
  const post = getStore().find((item) => item.id === id)
  if (!post) return null

  post.comments.push({
    id: `cmt_${Date.now()}`,
    author,
    content,
    createdAt: new Date().toISOString(),
    likes: [],
  })

  return clonePost(post)
}

export function incrementViews(id: string): void {
  const post = getStore().find((item) => item.id === id)
  if (post) post.views += 1
}
