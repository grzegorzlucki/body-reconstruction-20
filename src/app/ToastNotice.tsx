import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ui } from "../i18n/config";

function ToastMessage({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useTranslation();
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), 4000);
    const dismiss = window.setTimeout(onDismiss, 4400);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(dismiss);
    };
  }, [onDismiss]);
  return (
    <div className={`toast-message${leaving ? " toast-leaving" : ""}`}>
      <span className="toast-check" aria-hidden="true">
        ✓
      </span>
      <span>{ui(message)}</span>
    </div>
  );
}

export function ToastNotice({
  message,
  noticeId,
  onDismiss,
}: {
  message: string;
  noticeId: number;
  onDismiss: () => void;
}) {
  // Keep the live region mounted; only the message changes. No focus or click handlers.
  return (
    <div
      className="toast-region"
      role={message ? "status" : undefined}
      aria-live="polite"
      aria-atomic="true"
    >
      {message && (
        <ToastMessage key={noticeId} message={message} onDismiss={onDismiss} />
      )}
    </div>
  );
}
