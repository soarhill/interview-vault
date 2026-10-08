import { AdminInterviewEditPage } from "@/components/review/admin-interview-edit-page";

export const metadata = { title: "编辑已发布内容 · 面个 Offer" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminInterviewEditPage id={id} />;
}
