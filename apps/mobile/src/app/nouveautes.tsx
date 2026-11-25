import { changelogFor } from "@leximon/view-model";
import { NewsEntries } from "@/screens/news/news-entries";
import { Page } from "@/ui/page";
import { OnPaper } from "@/ui/panel";

export default function NewsRoute() {
  return (
    <Page title="Nouveautés">
      <OnPaper>
        <NewsEntries entries={changelogFor("mobile")} />
      </OnPaper>
    </Page>
  );
}
