"use client";

import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";
import styles from "./toast.module.css";

/** How long a toast stays (C-07). */
const TOAST_MS = 2600;

const ToastContext = createContext<(message: string) => void>(() => undefined);

/** One line at the bottom of the screen, read out by screen readers (C-07). */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  // A new message restarts the clock, so that each one is readable.
  const [key, setKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((text: string) => {
    if (timer.current !== null) clearTimeout(timer.current);
    setMessage(text);
    setKey((k) => k + 1);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  return (
    <ToastContext.Provider value={say}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {message !== null && (
          <p key={key} className={styles.toast}>
            {message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
