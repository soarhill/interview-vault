import { ReviewListPage } from "@/components/review/review-list-page";

export const metadata = { title: "投稿审核 · 面个 Offer" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; done?: string; view?: string }>;
}) {
  const query = await searchParams;
  const page = Number(query.page);
  const done = typeof query.done === "string" ? query.done : undefined;
  const view = typeof query.view === "string" ? query.view : undefined;
  return (
    <ReviewListPage
      page={Number.isSafeInteger(page) && page > 0 ? page : 1}
      done={done}
      view={view}
    />
  );
}
