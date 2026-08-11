import type { Metadata } from "next";

import "./globals.css";
import { ToastProvider } from "@/components/ui/toast-provider";

export const metadata: Metadata = {
  title: "แพลตฟอร์มจัดการ Computer Vision",
  description: "พื้นที่จัดการรูปภาพ Annotation, Dataset และการ Train โมเดล Computer Vision",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
