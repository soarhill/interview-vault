import { ChangeRequestListPage } from "@/components/review/change-request-list-page";

export const metadata = { title: "变更申请 · 面个 Offer" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = Number(query.page);
  return (
    <ChangeRequestListPage
      page={Number.isSafeInteger(page) && page > 0 ? page : 1}
    />
  );
}
