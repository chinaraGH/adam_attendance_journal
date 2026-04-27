import type { CurrentUser } from "@/lib/auth/get-current-user";

export function Navbar(props: { user: CurrentUser }) {
  const { user: _user } = props;
  return (
    <div className="border-b bg-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-start p-4">
        {/* reserved for future navigation */}
      </div>
    </div>
  );
}

