"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./select.module.css";

export interface SelectOption<T extends string = string> {
  readonly value: T;
  readonly label: ReactNode;
}

export interface SelectProps<T extends string = string> {
  readonly value: T;
  readonly options: readonly SelectOption<T>[];
  readonly onChange: (value: T) => void;
  readonly ariaLabel?: string;
  readonly className?: string;
}

/**
 * Custom dropdown menu replacing the native OS `<select>` so options can render rich content
 * (like rarity gems) and match the dark theme cleanly.
 */
export function Select<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (next) setActiveIndex(selectedIndex);
      return next;
    });
  };

  const choose = (nextValue: T) => {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (options.length === 0) return;
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex);
        setOpen(true);
      } else {
        setActiveIndex((current) => (current + 1) % options.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex);
        setOpen(true);
      } else {
        setActiveIndex((current) => (current - 1 + options.length) % options.length);
      }
      return;
    }
    if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const target = options[activeIndex];
      if (target !== undefined) choose(target.value);
    }
  };

  const currentOption = options.find((option) => option.value === value) ?? options[0];

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegates arrow/escape keys for the trigger and option buttons inside.
    <div ref={rootRef} className={`${styles.root} ${className ?? ""}`} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        <span className={styles.triggerValue}>{currentOption?.label}</span>
        <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M4 6.5L8 10.5L12 6.5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul className={styles.menu}>
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  className={`${styles.option} ${selected ? styles.optionSelected : ""} ${active ? styles.optionActive : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option.value)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  <svg className={styles.check} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3.5 8.5L6.5 11.5L12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
