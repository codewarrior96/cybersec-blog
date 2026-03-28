/* ── In-memory community post store ──────────────────────────────
   Sunucu restart'ında sıfırlanır — kalıcı DB entegrasyonu için
   soc-store-adapter pattern'ini kullanabilirsiniz.
─────────────────────────────────────────────────────────────── */

export type PostCategory = 'CTF' | 'WEB' | 'PENTEST' | 'MALWARE' | 'OSINT' | 'NETWORK' | 'GENERAL';
export type PostDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CommunityComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  likes: string[];
}

export interface CommunityPost {
  id: string;
  author: string;
  authorRole: string;
  title: string;
  content: string;
  category: PostCategory;
  difficulty: PostDifficulty;
  tags: string[];
  likes: string[];
  comments: CommunityComment[];
  createdAt: string;
  views: number;
}

/* ── Seed posts ── */
const SEED: CommunityPost[] = [
  {
    id: 'seed1',
    author: 'ghost',
    authorRole: 'Security Researcher',
    title: 'SQL Injection ile Admin Panel Bypass',
    content: "Bu writeup'ta gerçek bir bug bounty programında bulduğum SQL injection açığını anlatacağım. Hedef site login formunda parameterized query kullanmıyordu. ' OR '1'='1 payload'ı ile admin paneline girdim. Detayları aşağıda bulabilirsiniz.",
    category: 'WEB',
    difficulty: 'intermediate',
    tags: ['sql', 'bypass', 'bugbounty'],
    likes: ['user1', 'user2', 'user3'],
    comments: [
      { id: 'c1', author: 'user1', content: 'Harika writeup, özellikle UNION based kısmı çok açıklayıcı!', createdAt: new Date(Date.now() - 3600000).toISOString(), likes: [] },
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    views: 142,
  },
  {
    id: 'seed2',
    author: 'r3d_h00d',
    authorRole: 'CTF Player',
    title: 'PicoCTF 2024 — Web Exploitation Writeup',
    content: "Bu yazıda PicoCTF 2024'teki web kategorisindeki soruları çözümlerini paylaşıyorum. Özellikle JWT manipulation ve SSRF sorularında ilginç teknikler kullandım.",
    category: 'CTF',
    difficulty: 'beginner',
    tags: ['ctf', 'picoctf', 'jwt', 'ssrf'],
    likes: ['ghost'],
    comments: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    views: 87,
  },
  {
    id: 'seed3',
    author: 'n3t_w4tch',
    authorRole: 'Network Engineer',
    title: 'Wireshark ile MITM Tespiti',
    content: 'ARP poisoning saldırısını Wireshark filtresiyle nasıl tespit edebileceğinizi anlatan kısa bir rehber. Arp.duplicate-address-frame filtresi ile anormal ARP paketlerini yakalamanın yolları.',
    category: 'NETWORK',
    difficulty: 'intermediate',
    tags: ['wireshark', 'arp', 'mitm', 'detection'],
    likes: ['ghost', 'user1'],
    comments: [],
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    views: 203,
  },
];

/* ── Store singleton ── */
const globalKey = '__community_store__' as const;
declare global {
  // eslint-disable-next-line no-var
  var __community_store__: CommunityPost[] | undefined;
}

function getStore(): CommunityPost[] {
  if (!global[globalKey]) {
    global[globalKey] = [...SEED];
  }
  return global[globalKey]!;
}

/* ── Public API ── */
export function listPosts(opts: {
  category?: PostCategory;
  difficulty?: PostDifficulty;
  sort?: 'newest' | 'popular' | 'views';
  limit?: number;
}): CommunityPost[] {
  let posts = [...getStore()];

  if (opts.category) posts = posts.filter(p => p.category === opts.category);
  if (opts.difficulty) posts = posts.filter(p => p.difficulty === opts.difficulty);

  const sort = opts.sort ?? 'newest';
  if (sort === 'newest')  posts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === 'popular') posts.sort((a, b) => b.likes.length - a.likes.length);
  if (sort === 'views')   posts.sort((a, b) => b.views - a.views);

  return posts.slice(0, opts.limit ?? 50);
}

export function createPost(input: {
  author: string;
  authorRole: string;
  title: string;
  content: string;
  category: PostCategory;
  difficulty: PostDifficulty;
  tags: string[];
}): CommunityPost {
  const post: CommunityPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    likes: [],
    comments: [],
    createdAt: new Date().toISOString(),
    views: 0,
  };
  getStore().unshift(post);
  return post;
}

export function likePost(id: string, userId: string): CommunityPost | null {
  const post = getStore().find(p => p.id === id);
  if (!post) return null;
  const idx = post.likes.indexOf(userId);
  if (idx === -1) post.likes.push(userId);
  else post.likes.splice(idx, 1); // toggle
  return post;
}

export function addComment(id: string, author: string, content: string): CommunityPost | null {
  const post = getStore().find(p => p.id === id);
  if (!post) return null;
  post.comments.push({
    id: `cmt_${Date.now()}`,
    author,
    content,
    createdAt: new Date().toISOString(),
    likes: [],
  });
  return post;
}

export function incrementViews(id: string): void {
  const post = getStore().find(p => p.id === id);
  if (post) post.views++;
}
