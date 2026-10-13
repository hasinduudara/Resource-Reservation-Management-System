"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "@/app/(admin)/admin/categories/actions";
import type { CategoryWithCount } from "@/services/categories";

interface CategoryFormDialogProps {
  category?: CategoryWithCount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryFormDialog({
  category,
  open,
  onOpenChange,
}: CategoryFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [errors, setErrors] = useState<{ name?: string[]; description?: string[] }>({});

  const isEditing = Boolean(category);

  // Sync state when category changes
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setName(category?.name || "");
      setDescription(category?.description || "");
      setErrors({});
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);

    startTransition(async () => {
      const res = isEditing && category
        ? await updateCategoryAction(category.id, { success: false }, formData)
        : await createCategoryAction({ success: false }, formData);

      if (res.success) {
        toast.success(isEditing ? "Category updated successfully" : "Category created successfully");
        onOpenChange(false);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        if (res.message) {
          toast.error(res.message);
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update category details. Categories group resources for easy discovery."
                : "Add a new category to group equipment, facilities, or spaces."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Meeting Room, Vehicle"
                required
                disabled={isPending}
              />
              {errors.name?.[0] && (
                <p className="text-xs text-destructive">{errors.name[0]}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Description</Label>
              <Textarea
                id="category-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of resources belonging to this category..."
                rows={3}
                disabled={isPending}
              />
              {errors.description?.[0] && (
                <p className="text-xs text-destructive">{errors.description[0]}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                ? "Save Changes"
                : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteCategoryDialogProps {
  category: CategoryWithCount;
}

export function DeleteCategoryDialog({ category }: DeleteCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasResources = category._count.resources > 0;

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteCategoryAction(category.id);
      if (res.success) {
        toast.success(`Deleted category "${category.name}"`);
        setOpen(false);
      } else {
        toast.error(res.message || "Failed to delete category");
      }
    });
  };

  if (hasResources) {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled
        className="h-8 px-2 text-xs text-muted-foreground/50 cursor-not-allowed"
        title="Cannot delete category containing resources"
      >
        Delete
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete category{" "}
              <strong className="text-foreground">&quot;{category.name}&quot;</strong>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
