"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  title: string;
  href: string;
  exact?: boolean;
  disabled?: boolean;
  badge?: string;
}

const navItems: NavItem[] = [
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
    href: "#",
    disabled: true,
    badge: "Soon",
  },
];

export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <div className="border-b bg-muted/40">
      <div className="container mx-auto px-4 sm:px-6">
        <nav className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto" aria-label="Admin Navigation">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : item.href !== "#" && pathname.startsWith(item.href);

            if (item.disabled) {
              return (
                <div
                  key={item.title}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-muted-foreground/60 cursor-not-allowed select-none rounded-md"
                >
                  <span>{item.title}</span>
                  {item.badge && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal text-muted-foreground/50 border-muted-foreground/30">
                      {item.badge}
                    </Badge>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <span>{item.title}</span>
                {item.badge && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
