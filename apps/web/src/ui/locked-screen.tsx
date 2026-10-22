import { ButtonLink } from "./button";
import { Icon, type IconName } from "./icon";
import { XpBar } from "./level-bits";
import styles from "./locked-screen.module.css";
import ui from "./ui.module.css";

/**
 * A feature closed by the level: what opens it, a sentence of promise, the way there.
 * Without `level`, the feature is open but not built yet: the same screen, without the bar.
 */
export function LockedScreen({
  icon,
  level,
  title,
  text,
  left,
  ratio,
}: {
  readonly icon: IconName;
  readonly level?: number;
  readonly title: string;
  readonly text: string;
  readonly left?: string;
  readonly ratio?: number;
}) {
  return (
    <main className={`${ui.panel} ${ui.enter} ${styles.screen}`}>
      <span className={styles.icon}>
        <Icon name={icon} size={38} />
      </span>
      {level !== undefined && <p className={`${ui.kicker} ${styles.kicker}`}>Niveau {level}</p>}
      <h1 className={`${ui.display} ${styles.title}`}>{title}</h1>
      <p className={styles.text}>{text}</p>
      {ratio !== undefined && (
        <>
          <XpBar ratio={ratio} className={styles.bar} />
          <p className={styles.left}>{left}</p>
        </>
      )}
      <div className={styles.actions}>
        <ButtonLink href="/jouer">Ouvrir un sachet</ButtonLink>
        <ButtonLink href="/defis" variant="secondary">
          Faire un défi
        </ButtonLink>
      </div>
    </main>
  );
}
