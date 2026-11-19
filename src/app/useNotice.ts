import {
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export function useNotice() {
  const [notice, update] = useState({ message: "", id: 0 });
  const setNotice: Dispatch<SetStateAction<string>> = useCallback((value) => {
    update((current) => ({
      message: typeof value === "function" ? value(current.message) : value,
      id: current.id + 1,
    }));
  }, []);
  const clearNotice = useCallback(() => setNotice(""), [setNotice]);
  return {
    notice: notice.message,
    noticeId: notice.id,
    setNotice,
    clearNotice,
  };
}
