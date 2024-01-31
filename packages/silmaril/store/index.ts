export default class Store<T> {
  private alive = true;

  private value: T;

  private listeners = new Set<(value: T) => void>();

  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }

  set(value: T): T {
    if (this.alive && !Object.is(this.value, value)) {
      this.value = value;

      for (const listener of this.listeners.keys()) {
        if (this.alive) {
          listener(value);
        }
      }
    }
    return value;
  }

  subscribe(callback: () => void): () => void {
    if (this.alive) {
      this.listeners.add(callback);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  destroy() {
    if (this.alive) {
      this.alive = false;
      this.listeners.clear();
    }
  }
}
