import { ChangeRequestDetailPage } from "@/components/review/change-request-detail-page";

export const metadata = { title: "审核变更申请 · 面个 Offer" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChangeRequestDetailPage id={id} />;
}
