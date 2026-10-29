import { CHANGELOG } from "@leximon/view-model";
import { NewsEntries } from "@/screens/news/news-entries";
import { Page } from "@/ui/page";

export default function NewsRoute() {
  return (
    <Page title="Nouveautés">
      <NewsEntries entries={CHANGELOG} />
    </Page>
  );
}
