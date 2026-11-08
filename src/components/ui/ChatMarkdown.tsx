import React, { Suspense } from 'react';
import { lazyWithReload } from '../../appRecovery';

const Renderer = lazyWithReload(() => import('./ChatMarkdownRenderer'));

/**
 * Formatted AI answer (Markdown, tables, LaTeX formulas). The renderer and KaTeX load the first time
 * an answer is shown; until then the plain text is displayed, so nothing ever appears blank.
 */
export const ChatMarkdown: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={className}>
    <Suspense fallback={<div className="whitespace-pre-wrap">{text}</div>}>
      <Renderer text={text} />
    </Suspense>
  </div>
);
