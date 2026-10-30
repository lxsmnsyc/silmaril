/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The address of the site without a trailing slash, such as `https://silmaril.dev`. */
  readonly SITE_URL: string;
}

declare module '*.md' {
  import type { Page } from './docs.ts';

  const page: Page;
  export default page;
}

declare module 'virtual:search-index' {
  export const index: {
    page: string;
    pageTitle: string;
    heading: string;
    id: string;
    text: string;
  }[];
}
