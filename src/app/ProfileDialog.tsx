import { useEffect, useRef, useState, type FormEvent } from "react";

export function ProfileDialog({ mode, initialName, onClose, onSave }: {
  mode: "add" | "rename" | null;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (mode) {
      setName(mode === "rename" ? initialName : "");
      setError("");
      if (!dialog.current?.open) dialog.current?.showModal();
    } else dialog.current?.close();
  }, [mode, initialName]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || clean.length > 80) {
      setError("Nazwa profilu musi mieć od 1 do 80 znaków.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(clean);
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać profilu.");
    } finally { setSaving(false); }
  }
  return <dialog ref={dialog} className="profile-dialog" aria-labelledby="profile-dialog-title"
    onClose={onClose}>
    <form onSubmit={(event) => void submit(event)}>
      <h2 id="profile-dialog-title">{mode === "add" ? "Dodaj profil" : "Zmień nazwę profilu"}</h2>
      <label>Nazwa profilu
        <input name="profileName" autoComplete="off" maxLength={80}
          value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      {error && <p role="alert" className="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={saving}>{saving ? "Zapisywanie…" : "Zapisz profil"}</button>
        <button type="button" className="secondary" disabled={saving}
          onClick={() => dialog.current?.close()}>Anuluj</button>
      </div>
    </form>
  </dialog>;
}
