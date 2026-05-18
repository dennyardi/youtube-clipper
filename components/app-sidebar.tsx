"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { Clock3, FileText, Gauge, ListChecks, PlaySquare, Settings, SlidersHorizontal } from "lucide-react";

const items = [
  { href: "/analysis/long", label: "Long Video", icon: PlaySquare },
  { href: "/analysis/short", label: "Short Video", icon: Gauge },
  { href: "/history", label: "Riwayat", icon: Clock3 },
  { href: "/presets", label: "Preset", icon: SlidersHorizontal },
  { href: "/settings", label: "Setting", icon: Settings },
  { href: "/logs", label: "Log", icon: FileText },
];

export function AppSidebar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <aside className="hidden w-72 shrink-0 border-r border-line bg-white/95 px-4 py-5 shadow-sm md:block">
      <div className="mb-8 flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-brand text-white">
          <ListChecks size={20} />
        </div>
        <div>
          <div className="text-base font-semibold">Youtube Clipper</div>
          <div className="text-xs text-muted">Maker Dashboard</div>
        </div>
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-panel hover:text-brand"
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 border-t border-line pt-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
