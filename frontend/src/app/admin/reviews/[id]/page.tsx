import { ReviewDetailPage } from "@/components/review/review-detail-page";

export const metadata = { title: "审核投稿 · 面个 Offer" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewDetailPage id={id} />;
}
