"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-panel" onClick={logout}>
      <LogOut size={18} />
      Logout
    </button>
  );
}
