import type { ReactNode } from "react";
import "./globals.css";

import { AppChrome } from "@/components/app-chrome";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppChrome />
        {children}
      </body>
    </html>
  );
}
