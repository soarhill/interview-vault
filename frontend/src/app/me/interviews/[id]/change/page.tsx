import { ChangeRequestPage } from "@/components/submission/change-request-page";
export const metadata = { title: "申请修改 / 删除 · 面个 Offer" };
export default async function InterviewChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  return (
    <ChangeRequestPage
      id={id}
      initialType={type === "DELETE" ? "DELETE" : undefined}
    />
  );
}
