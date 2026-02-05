"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboardIcon, UsersIcon, ShieldIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/customers", label: "Customers", icon: UsersIcon },
];

const adminLinks = [
  { href: "/users", label: "Users", icon: ShieldIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setIsAdmin(data.role === "admin");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCurrentUser();
  }, []);

  if (loading) {
    return (
      <aside className="flex w-64 flex-col border-r bg-white">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-semibold">ACME CRM</span>
        </div>
      </aside>
    );
  }

  const allLinks = [...baseLinks, ...(isAdmin ? adminLinks : [])];

  // For non-admins, show Users as disabled link
  const displayLinks = isAdmin ? allLinks : [
    ...baseLinks,
    { href: "/users", label: "Users", icon: ShieldIcon, disabled: true, tooltip: "You do not have permission to access this." },
  ];

  return (
    <aside className="flex w-64 flex-col border-r bg-white">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold">ACME CRM</span>
      </div>
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-1">
          {displayLinks.map(({ href, label, icon: Icon, disabled, tooltip }) => (
            <li key={href}>
              {disabled ? (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-not-allowed text-gray-400"
                  )}
                  title={tooltip}
                >
                  <Icon className="size-4" />
                  {label}
                </div>
              ) : (
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === href || pathname.startsWith(href + "/")
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
