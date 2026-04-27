import type { ReactNode } from "react";

import { AppChrome } from "@/components/app-chrome";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-gray-50">
        <AppChrome />
        {children}
      </body>
    </html>
  );
}
