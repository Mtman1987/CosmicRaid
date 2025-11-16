type Events = {
  error: any;
};

export class FirebaseErrorEmitter {
  private static instance: FirebaseErrorEmitter;
  private listeners: { [K in keyof Events]?: ((event: Events[K]) => void)[] } = {};

  private constructor() {}

  public static getInstance(): FirebaseErrorEmitter {
    if (!FirebaseErrorEmitter.instance) {
      FirebaseErrorEmitter.instance = new FirebaseErrorEmitter();
    }
    return FirebaseErrorEmitter.instance;
  }

  public on<K extends keyof Events>(event: K, listener: (event: Events[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  public off<K extends keyof Events>(event: K, listener: (event: Events[K]) => void): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event]!.filter(l => l !== listener);
  }

  public emit<K extends keyof Events>(event: K, data: Events[K]): void {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event]!.forEach(listener => listener(data));
  }
}
