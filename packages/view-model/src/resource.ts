/**
 * Player state shared by every screen of the page (wallet, coffrets, account): read once from the
 * API, then replaced by what actions return (`publish`), without another request. The server
 * stays the authority: this is only the freshest copy the client has.
 */
export interface SharedResource<T> {
  publish(value: T): void;
  /** Reads it again from the API, e.g. once a refill is due. */
  refresh(): void;
  current(): T | null;
  /** Whether the last read of the API failed, with nothing come since. */
  failed(): boolean;
  /** Reads it if it was never read, or failed last time. */
  ensure(): void;
  /**
   * The value for a screen that needs it now: the copy in hand if the API was read less than
   * `maxAgeMs` ago (actions keep it current in between), the API's otherwise.
   */
  read(maxAgeMs?: number): Promise<T>;
  subscribe(listener: () => void): () => void;
  /**
   * Forgets the value, as if never read: another player signed in on this device. A read
   * still on its way is dropped when it lands.
   */
  reset(): void;
}

export function sharedResource<T>(load: () => Promise<T>): SharedResource<T> {
  let value: T | null = null;
  let loading: Promise<T> | null = null;
  let stale = true;
  let failed = false;
  /** When the API was last read, as opposed to updated from an action's answer. */
  let readAt = 0;
  /** Bumped by `reset`: a read started before it no longer counts. */
  let generation = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };
  const fetchIt = (): Promise<T> => {
    if (loading !== null) return loading;
    stale = false;
    if (failed) {
      failed = false;
      emit();
    }
    const started = generation;
    const request = load()
      .then((loaded) => {
        if (started !== generation) return loaded;
        value = loaded;
        readAt = Date.now();
        emit();
        return loaded;
      })
      .catch((error: unknown) => {
        if (started !== generation) throw error;
        // Left as it was; the next screen that mounts, or a retry, tries again.
        stale = true;
        failed = true;
        emit();
        throw error;
      })
      .finally(() => {
        if (started === generation) loading = null;
      });
    loading = request;
    return request;
  };
  const fetchQuietly = () => {
    // A screen that needs the answer uses `read`, which reports the failure.
    fetchIt().catch(() => {});
  };

  return {
    publish(next) {
      value = next;
      stale = false;
      failed = false;
      emit();
    },
    refresh() {
      stale = true;
      fetchQuietly();
    },
    current: () => value,
    failed: () => failed,
    ensure() {
      if (stale) fetchQuietly();
    },
    read(maxAgeMs = Number.POSITIVE_INFINITY) {
      if (value !== null && !stale && loading === null && Date.now() - readAt < maxAgeMs) {
        return Promise.resolve(value);
      }
      return fetchIt();
    },
    reset() {
      generation += 1;
      value = null;
      loading = null;
      stale = true;
      failed = false;
      readAt = 0;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
