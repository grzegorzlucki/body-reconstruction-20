export function LoadingScreen({
  fullScreen = false,
  inline = false,
}: {
  fullScreen?: boolean;
  inline?: boolean;
}) {
  return (
    <div
      className={`loading-screen${fullScreen ? " loading-screen-full" : ""}${inline ? " loading-screen-inline" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="loading-ring" aria-hidden="true" />
      <span>Wczytywanie…</span>
    </div>
  );
}
