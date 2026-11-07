import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeMath } from './chatMath';

/**
 * Markdown + LaTeX for AI answers. Loaded on demand (see ChatMarkdown) so the landing page does not
 * pay for KaTeX. Raw HTML in answers is NOT rendered: react-markdown escapes it.
 */

const components: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h3 className="mt-3 mb-1.5 first:mt-0 text-[0.95rem] font-extrabold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1.5 first:mt-0 text-[0.92rem] font-extrabold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2.5 mb-1 first:mt-0 text-[0.9rem] font-bold">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-2 mb-1 first:mt-0 font-bold">{children}</h4>,
  ul: ({ children }) => <ul className="my-1.5 pl-4 list-disc space-y-1 marker:text-cyan-500">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 pl-4 list-decimal space-y-1 marker:text-cyan-500 marker:font-semibold">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-cyan-600 dark:text-cyan-400 underline underline-offset-2 break-words">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 pl-3 border-l-2 border-cyan-400/60 text-slate-600 dark:text-slate-300 italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200 dark:border-slate-700" />,
  code: ({ className, children }) =>
    className ? (
      <code className={`${className} block`}>{children}</code>
    ) : (
      <code className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[0.85em] font-mono break-words">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[0.8rem] leading-relaxed overflow-x-auto font-mono">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 table-scroll rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-[0.85em] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="px-2 py-1 text-left font-bold bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 align-top">{children}</td>,
};

const ChatMarkdownRenderer: React.FC<{ text: string }> = ({ text }) => (
  <div className="chat-markdown break-words">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', output: 'html' }]]}
      components={components}
    >
      {normalizeMath(text)}
    </ReactMarkdown>
  </div>
);

export default ChatMarkdownRenderer;
