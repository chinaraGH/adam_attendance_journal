import type { ReactNode } from "react";

import { Navbar } from "@/components/navbar";
import { getCurrentUser } from "@/lib/auth/get-current-user";

export default function RootLayout({ children }: { children: ReactNode }) {
  // Navbar hidden on /login via middleware public route (unauthenticated render).
  // For logged-in users it will always render.
  return (
    <html lang="ru">
      <body className="bg-gray-50">
        {/* getCurrentUser throws if not authorized; keep login page simple by not importing layout there */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <AuthNavbar />
        {children}
      </body>
    </html>
  );
}

async function AuthNavbar() {
  try {
    const user = await getCurrentUser();
    return <Navbar user={user} />;
  } catch {
    return null;
  }
}
