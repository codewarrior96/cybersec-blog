import { getPostBySlug, getAllPosts } from '@/lib/posts';
import { MDXRemote } from 'next-mdx-remote/rsc';
import MDXComponents from '@/components/MDXComponents';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import rehypePrettyCode from 'rehype-pretty-code';
import Link from 'next/link';
import ReadingProgress from '@/components/ReadingProgress';
import BackToTop from '@/components/BackToTop';

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: post.description,
    },
  };
}

const prettyCodeOptions = {
  theme: 'github-dark',
  keepBackground: true,
};

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  const formattedDate = post.date
    ? new Date(post.date).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <>
      <ReadingProgress />
      <BackToTop />

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <div className="font-mono text-sm text-slate-500 mb-10">
          <Link href="/" className="hover:text-green-400 transition-colors">~</Link>
          <span className="mx-1">/</span>
          <Link href="/blog" className="hover:text-green-400 transition-colors">blog</Link>
          <span className="mx-1">/</span>
          <span className="text-slate-300">{params.slug}</span>
        </div>

        <div className="max-w-2xl">
          {/* Meta */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-2 mb-4">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded font-mono text-xs bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-bold text-slate-100 leading-tight mb-4">
            {post.title}
          </h1>

          {post.description && (
            <p className="text-slate-400 text-lg mb-6 leading-relaxed">{post.description}</p>
          )}

          <div className="flex items-center gap-4 text-sm text-slate-500 font-mono pb-8 border-b border-slate-800">
            <time>{formattedDate}</time>
          </div>

          {/* İçerik */}
          <article className="mt-10 prose-cybersec">
            <MDXRemote
              source={post.content}
              components={MDXComponents}
              options={{
                mdxOptions: {
                  rehypePlugins: [[rehypePrettyCode as any, prettyCodeOptions]],
                },
              }}
            />
          </article>

          {/* Geri */}
          <div className="mt-16 pt-8 border-t border-slate-800">
            <Link
              href="/blog"
              className="font-mono text-sm text-slate-400 hover:text-green-400 transition-colors"
            >
              ← tüm yazılara dön
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
