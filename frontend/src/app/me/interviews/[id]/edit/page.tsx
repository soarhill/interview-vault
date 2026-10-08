import { SubmissionEditPage } from "@/components/submission/submission-edit-page";
export const metadata = { title: "编辑投稿 · 面个 Offer" };
export default async function EditInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SubmissionEditPage id={id} />;
}
