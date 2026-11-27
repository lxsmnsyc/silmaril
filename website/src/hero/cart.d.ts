// Types of the landing page demo, which stays plain `.js` so the page shows it as written.
export interface CartUi {
  show: (name: string, value: unknown) => void;
  add?: () => void;
  write?: (text: string) => void;
}

export declare function cart(ui: CartUi): () => void;
