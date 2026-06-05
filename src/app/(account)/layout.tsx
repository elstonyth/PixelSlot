import { type ReactNode } from "react";
import AccountSidebar from "@/components/account/AccountSidebar";

// Shared shell for the account/wallet pages (URLs stay top-level via the route group).
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full px-fluid py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <AccountSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
