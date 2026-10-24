"use client";

import { useId } from "react";
import { Icon } from "@/ui/icon";
import styles from "./friends.module.css";

/** The search field over a long list of friends, here and in a new trade. */
export function FriendSearch({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={styles.searchField}>
      <Icon name="search" size={17} />
      <input
        id={id}
        type="search"
        autoComplete="off"
        placeholder="Chercher un ami"
        aria-label="Chercher un ami"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
