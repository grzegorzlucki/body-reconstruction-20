import { useEffect, useRef, useState } from "react";

export function useConfirmation() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null);
  const ignoreClose = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (message && !dialog?.open) dialog?.showModal();
    if (!message && dialog?.open) dialog.close();
  }, [message]);

  function finish(accepted: boolean) {
    resolveRef.current?.(accepted);
    resolveRef.current = null;
    setMessage(null);
    if (dialogRef.current?.open) {
      ignoreClose.current = true;
      dialogRef.current.close();
    }
  }

  function ask(message: string): Promise<boolean> {
    if (resolveRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setMessage(message);
    });
  }

  const dialog = <dialog ref={dialogRef} className="confirm-dialog" role="alertdialog"
    aria-labelledby="confirm-title" aria-describedby="confirm-message"
    onClose={() => {
      if (ignoreClose.current) {
        ignoreClose.current = false;
        return;
      }
      finish(false);
    }}>
    <h2 id="confirm-title">Potwierdź działanie</h2>
    <p id="confirm-message">{message}</p>
    <div className="actions">
      <button type="button" className="secondary" autoFocus onClick={() => finish(false)}>Anuluj</button>
      <button type="button" onClick={() => finish(true)}>Potwierdź</button>
    </div>
  </dialog>;

  return { ask, dialog };
}
