import { type PackCollection, PackSeal, packVariables } from "@/booster/pack-looks";
import styles from "./collection-seal.module.css";

/** The gold seal of a collection's sachet, small, beside its name. */
export function CollectionSeal({
  collection,
  size,
}: {
  readonly collection: PackCollection;
  readonly size: number;
}) {
  return (
    <span
      className={styles.seal}
      style={{ ...packVariables(collection), width: size, height: size }}
    >
      <PackSeal collectionId={collection.id} engraving={collection.engraving} />
    </span>
  );
}
