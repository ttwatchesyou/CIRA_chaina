import { MobileUploadForm } from "@/components/upload/mobile-upload-form";

export const dynamic = "force-dynamic";

export default async function MobileUploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MobileUploadForm token={token} />;
}
