import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { listCategories } from "@/services/categories";
import { ResourceForm } from "@/components/admin/resource-form";

export const metadata: Metadata = {
  title: "New Resource | Admin | Resource Reservation Management System",
  description: "Create a new organizational resource.",
};

export default async function NewResourcePage() {
  await requireRole("ADMIN");
  const categories = await listCategories();

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
      <ResourceForm categories={categories} />
    </div>
  );
}
