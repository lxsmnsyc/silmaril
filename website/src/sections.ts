// The sections of the sidebar, in reading order, by the path of each page after `/docs/`.
// Plain data with no Vite imports, so `plugins/llms.ts` can read it in Node.js.

export const SECTIONS: { title: string; pages: string[] }[] = [
  { title: 'Start', pages: ['', 'getting-started', 'bundler-setup'] },
  {
    title: 'Concepts',
    pages: [
      'basic-reactivity',
      'computed-variables',
      'lifecycles',
      'synchronous-tracking',
      'composition',
    ],
  },
  { title: 'Integrations', pages: ['stores', 'solid'] },
  { title: 'Reference', pages: ['api', 'errors', 'glossary'] },
  { title: 'Help', pages: ['troubleshooting', 'limits', 'migration'] },
  { title: 'Internals', pages: ['internals'] },
];
