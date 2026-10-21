import { GameShell } from "@/shell/game-shell";

/** The game's screens, inside the shell. The public home page stays outside. */
export default function GameLayout({ children }: LayoutProps<"/">) {
  return <GameShell>{children}</GameShell>;
}
