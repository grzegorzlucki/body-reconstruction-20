type SessionSource<T> = {
  getSession: () => Promise<{ data: { session: T | null }; error: unknown }>;
  onAuthStateChange: (callback: (event: string, session: T | null) => void) => {
    data: { subscription: { unsubscribe: () => void } };
  };
};

/** Resolve startup once, while continuing to observe later authentication events. */
export function watchAuthSession<T>(
  auth: SessionSource<T>,
  onSession: (session: T | null, event?: string) => void,
  onError: () => void,
) {
  let disposed = false,
    settled = false;
  const fail = () => {
    if (disposed || settled) return;
    settled = true;
    onError();
  };
  const timeout = setTimeout(fail, 15000);
  void auth
    .getSession()
    .then(({ data, error }) => {
      if (disposed || settled) return;
      if (error) {
        fail();
        return;
      }
      settled = true;
      clearTimeout(timeout);
      onSession(data.session);
    })
    .catch(fail);
  const {
    data: { subscription },
  } = auth.onAuthStateChange((event, session) => {
    if (disposed) return;
    settled = true;
    clearTimeout(timeout);
    onSession(session, event);
  });
  return () => {
    disposed = true;
    clearTimeout(timeout);
    subscription.unsubscribe();
  };
}
