import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";
export function LoadingScreen({
  fullScreen = false,
  inline = false,
}: {
  fullScreen?: boolean;
  inline?: boolean;
}) {
  useTranslation();
  return (
    <div
      className={`loading-screen${fullScreen ? " loading-screen-full" : ""}${inline ? " loading-screen-inline" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="loading-ring" aria-hidden="true" />
      <span>{ui("Wczytywanie…")}</span>
    </div>
  );
}
