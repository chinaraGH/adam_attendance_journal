import type { ReactNode } from "react";
import { headers } from "next/headers";

import { Navbar } from "@/components/navbar";
import { ExitButton } from "@/components/exit-button";
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
  const pathname = headers().get("x-pathname") ?? "";
  if (pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/attendance")) return null;

  try {
    const user = await getCurrentUser();
    return (
      <>
        <div style={{ position: "fixed", top: 16, left: 16, zIndex: 50 }}>
          <ExitButton />
        </div>
        <Navbar user={user} />
      </>
    );
  } catch {
    return null;
  }
}
