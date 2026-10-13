"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelReservationAction } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CancelReservationDialogProps {
  reservationId: string;
  resourceName: string;
  timeRange: string;
}

export function CancelReservationDialog({
  reservationId,
  resourceName,
  timeRange,
}: CancelReservationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelReservationAction(reservationId);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="xs" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30">
            Cancel
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Reservation</DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel your reservation for{" "}
            <span className="font-semibold text-foreground">{resourceName}</span> scheduled for{" "}
            <span className="font-semibold text-foreground">{timeRange}</span>?
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          This slot will be immediately freed up for other team members. This action cannot be undone.
        </p>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" disabled={isPending} />}>
            Keep Reservation
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? "Cancelling..." : "Yes, Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
