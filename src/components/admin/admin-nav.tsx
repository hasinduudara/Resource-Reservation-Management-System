"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

interface NavLinkItem {
  title: string;
  href: string;
  exact?: boolean;
}

const adminNavItems: NavLinkItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    exact: true,
  },
  {
    title: "Users",
    href: "/admin/users",
  },
  {
    title: "Resources",
    href: "/admin/resources",
  },
  {
    title: "Categories",
    href: "/admin/categories",
  },
  {
    title: "Reservations",
    href: "/admin/reservations",
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-3 sm:gap-5 text-sm font-medium overflow-x-auto py-1 scrollbar-none"
      aria-label="Admin Navigation"
    >
      {adminNavItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (item.href === "/admin/resources" && pathname.startsWith("/resources/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition-colors whitespace-nowrap",
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

const memberNavItems: NavLinkItem[] = [
  {
    title: "Resources",
    href: "/resources",
  },
  {
    title: "Availability",
    href: "/availability",
  },
  {
    title: "My Reservations",
    href: "/my-reservations",
  },
];

export function MemberNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-3 sm:gap-5 text-sm font-medium overflow-x-auto py-1 scrollbar-none"
      aria-label="Member Navigation"
    >
      {memberNavItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition-colors whitespace-nowrap",
              isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
