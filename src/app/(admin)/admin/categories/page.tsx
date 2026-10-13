import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { listCategories } from "@/services/categories";
import { CategoriesTable } from "@/components/admin/categories-table";

export const metadata: Metadata = {
  title: "Categories | Admin | Resource Reservation Management System",
  description: "Manage classification categories for resources.",
};

export default async function AdminCategoriesPage() {
  await requireRole("ADMIN");
  const categories = await listCategories();

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6">
      <CategoriesTable categories={categories} />
    </div>
  );
}
