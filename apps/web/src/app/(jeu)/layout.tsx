import { NavBar } from "@/components/nav-bar";

/** The game's screens, under the navigation bar. The public home page stays outside. */
export default function GameLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
