"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  ),
  borrowers: (
    <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  ),
  newloan: (
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
  ),
  loans: (
    <path d="M3 5v14h18V5H3zm16 12H5V7h14v10zM7 9h10v2H7V9zm0 4h6v2H7v-2z" />
  ),
  collections: (
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1H6.32c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" />
  ),
  remit: (
    <path d="M12 2 4 6v2h16V6l-8-4zM6 10v7h3v-7H6zm5 0v7h2v-7h-2zm5 0v7h3v-7h-3zM4 19v2h16v-2H4z" />
  ),
  audit: (
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-5 4h8v2H8v-2zm0 4h8v2H8v-2z" />
  ),
  settings: (
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  ),
};

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/borrowers", label: "Borrowers", icon: "borrowers" },
  { href: "/loans", label: "Loans", icon: "loans" },
  { href: "/loans/new", label: "New Loan", icon: "newloan" },
  { href: "/collections", label: "Collections", icon: "collections" },
  { href: "/remittances", label: "Remittances", icon: "remit" },
  { href: "/audit", label: "Audit Log", icon: "audit" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function SidebarNav({
  compact = false,
  showSettings = true,
}: {
  compact?: boolean;
  showSettings?: boolean;
}) {
  const pathname = usePathname();

  return (
    <ul className={compact ? "menu menu-horizontal flex-nowrap gap-1 p-0" : "menu w-full flex-1 gap-1 px-3"}>
      {NAV.filter((item) => showSettings || (item.href !== "/settings" && item.href !== "/audit")).map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/borrowers" && pathname.startsWith("/borrowers/")) ||
          (item.href === "/loans" && pathname.startsWith("/loans/") && pathname !== "/loans/new") ||
          (item.href === "/collections" && pathname.startsWith("/collections/")) ||
          (item.href === "/remittances" && pathname.startsWith("/remittances/")) ||
          (item.href === "/audit" && pathname.startsWith("/audit/")) ||
          (item.href === "/settings" && pathname.startsWith("/settings/"));
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                compact
                  ? `text-sm whitespace-nowrap ${active ? "menu-active font-semibold" : ""}`
                  : `text-base ${active ? "menu-active font-semibold" : ""}`
              }
            >
              {!compact && (
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 fill-current opacity-80"
                  aria-hidden
                >
                  {ICONS[item.icon]}
                </svg>
              )}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
