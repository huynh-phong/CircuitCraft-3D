/** Models also write \( \) and \[ \]: turn them into the $ / $$ that remark-math reads. */
export function normalizeMath(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n$$\n${body.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body.trim()}$`)
    // "$$ ... $$" written inside a sentence: put it on its own lines so it renders as a block
    .replace(/([^\n])\s*\$\$([^$]+?)\$\$/g, (_m, before, body) => `${before}\n\n$$\n${body.trim()}\n$$\n`);
}
