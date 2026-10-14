import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href={user.role === "ADMIN" ? "/admin" : "/resources"}
              className="text-lg font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            >
              RRSM
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              {user.role === "ADMIN" ? (
                <>
                  <Link
                    href="/admin"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/admin/users"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    Users
                  </Link>
                  <Link
                    href="/admin/resources"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    Resources
                  </Link>
                  <Link
                    href="/admin/categories"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    Categories
                  </Link>
                  <Link
                    href="/admin/reservations"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    Reservations
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/resources"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    Resources
                  </Link>
                  <Link
                    href="/availability"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    Availability
                  </Link>
                  <Link
                    href="/my-reservations"
                    className="text-foreground transition-colors hover:text-foreground/80"
                  >
                    My Reservations
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{user.name}</span>
              <Badge
                variant={user.role === "ADMIN" ? "default" : "secondary"}
                className="text-xs"
              >
                {user.role}
              </Badge>
            </div>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
