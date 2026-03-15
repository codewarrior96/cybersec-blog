import type { MDXComponents } from 'mdx/types';
import CodeBlock from './CodeBlock';

const components: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-slate-100 mt-10 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold text-slate-100 mt-8 mb-3 flex items-center gap-2">
      <span className="text-green-400 font-mono text-lg">#</span>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold text-slate-200 mt-6 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-slate-300 leading-7 mb-5">{children}</p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 transition-colors"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="font-mono text-sm bg-slate-800/80 text-green-400 px-1.5 py-0.5 rounded border border-slate-700">
      {children}
    </code>
  ),
  pre: (props) => <CodeBlock {...(props as React.HTMLAttributes<HTMLPreElement>)} />,
  ul: ({ children }) => (
    <ul className="my-5 space-y-2 text-slate-300 list-none pl-4">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-5 space-y-2 text-slate-300 list-decimal pl-6">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="flex gap-2 items-start">
      <span className="text-green-400 font-mono mt-0.5 shrink-0">›</span>
      <span>{children}</span>
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-6 pl-4 border-l-2 border-cyan-500 bg-cyan-500/5 py-3 pr-4 rounded-r-lg text-slate-300 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-10 border-slate-800" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-100">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-300">{children}</em>
  ),
};

export default components;
