// A description can be typed as plain text in the admin (paragraphs separated by
// a blank line) or written as HTML. Plain text loses every line break once it is
// injected into the page, which is why long descriptions arrived as one block.
// Anything already containing markup or entities is passed through untouched.
export function descriptionToHtml(text) {
  if (!text) return '';
  if (/<[a-z][^>]*>/i.test(text) || /&[a-z]+;/i.test(text)) return text;
  return text
    .split(/\r?\n\s*\r?\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${block.replace(/\r?\n/g, '<br />')}</p>`)
    .join('');
}
