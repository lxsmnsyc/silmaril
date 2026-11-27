// The search of the docs. The index loads the first time the palette opens, so a page that never
// opens search never loads it.

export interface SearchResult {
  id: string;
  href: string;
  page: string;
  heading: string;
  snippet: string;
  /** Whether the result is a section, not the start of a page. */
  section: boolean;
}

type Entry = Awaited<typeof import('virtual:search-index')>['index'][number];

const MAX_RESULTS = 10;
const SNIPPET_LENGTH = 120;
const base = import.meta.env.BASE_URL;

let loading: Promise<Entry[]> | undefined;

export function loadIndex(): Promise<Entry[]> {
  loading ??= import('virtual:search-index').then((module) => module.index);
  return loading;
}

function createSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) {
      at = found;
    }
  }
  // The start and the end move to the nearest space, so no word is cut.
  let start = Math.max(0, at - 30);
  if (start > 0) {
    while (start < text.length && text[start - 1] !== ' ') {
      start++;
    }
  }
  let end = Math.min(text.length, start + SNIPPET_LENGTH);
  if (end < text.length) {
    while (end > start && text[end] !== ' ') {
      end--;
    }
    if (end === start) {
      end = Math.min(text.length, start + SNIPPET_LENGTH);
    }
  }
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end).trim() +
    (end < text.length ? '…' : '')
  );
}

export async function runSearch(query: string): Promise<SearchResult[]> {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }
  const index = await loadIndex();
  const scored: { score: number; result: SearchResult }[] = [];
  for (const entry of index) {
    // Every term must appear. A term in the heading counts three times, in the page title twice.
    const heading = entry.heading.toLowerCase();
    const page = entry.pageTitle.toLowerCase();
    const text = entry.text.toLowerCase();
    let score = 0;
    let all = true;
    for (const term of terms) {
      if (heading.includes(term)) {
        score += 3;
      } else if (page.includes(term)) {
        score += 2;
      } else if (text.includes(term)) {
        score += 1;
      } else {
        all = false;
        break;
      }
    }
    if (!all) {
      continue;
    }
    const href = `${base}docs${entry.page ? `/${entry.page}` : ''}${entry.id ? `#${entry.id}` : ''}`;
    scored.push({
      score,
      result: {
        id: href,
        href,
        page: entry.pageTitle,
        heading: entry.heading,
        snippet: createSnippet(entry.text, terms),
        section: entry.id !== '',
      },
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const results: SearchResult[] = [];
  for (const item of scored.slice(0, MAX_RESULTS)) {
    results.push(item.result);
  }
  return results;
}
