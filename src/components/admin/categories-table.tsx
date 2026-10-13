"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryFormDialog, DeleteCategoryDialog } from "./category-dialogs";
import type { CategoryWithCount } from "@/services/categories";

interface CategoriesTableProps {
  categories: CategoryWithCount[];
}

export function CategoriesTable({ categories }: CategoriesTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Categories</h2>
          <p className="text-xs text-muted-foreground">
            Manage classification categories for resources.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          New Category
        </Button>
      </div>

      <CategoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {editingCategory && (
        <CategoryFormDialog
          category={editingCategory}
          open={Boolean(editingCategory)}
          onOpenChange={(open) => {
            if (!open) setEditingCategory(null);
          }}
        />
      )}

      {categories.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border rounded-lg bg-muted/20">
          No categories found. Create a category to start organizing resources.
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/4">Name</TableHead>
                <TableHead className="w-1/2">Description</TableHead>
                <TableHead className="text-center w-28">Resources</TableHead>
                <TableHead className="text-right pr-4 w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-semibold text-foreground">
                    {cat.name}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cat.description || <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {cat._count.resources}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCategory(cat)}
                        className="h-8 px-2 text-xs"
                      >
                        Edit
                      </Button>
                      <DeleteCategoryDialog category={cat} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
