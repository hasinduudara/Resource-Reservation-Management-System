"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createReservationAction, type CreateReservationState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: CreateReservationState = {
  success: false,
};

interface BookingFormProps {
  resourceId: string;
  resourceName: string;
  isActive: boolean;
}

export function BookingForm({ resourceId, resourceName, isActive }: BookingFormProps) {
  const [state, formAction, isPending] = useActionState(createReservationAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state.success, state.message]);

  if (!isActive) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-rose-800 dark:text-rose-300">
            Resource Inactive
          </CardTitle>
          <CardDescription className="text-rose-700/80 dark:text-rose-400">
            This resource is inactive and cannot be reserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Administrators can re-activate this resource from the admin management panel before accepting reservations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xs border">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold tracking-tight">Book this resource</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          15-minute slots, up to 8 hours, up to 180 days ahead, times in Sri Lanka time (Asia/Colombo).
        </CardDescription>
      </CardHeader>

      <form ref={formRef} action={formAction}>
        <input type="hidden" name="resourceId" value={resourceId} />

        <CardContent className="space-y-4">
          {/* General or Conflict Error Alert */}
          {!state.success && state.message && (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <div className="flex items-start gap-2">
                <svg
                  className="h-4 w-4 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{state.message}</span>
              </div>
            </div>
          )}

          {/* Time Slot Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startLocal" className="text-xs font-semibold">
                Start Time (Asia/Colombo)
              </Label>
              <input
                id="startLocal"
                name="startLocal"
                type="datetime-local"
                step="900"
                required
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              {state.fieldErrors?.startLocal?.[0] && (
                <p className="text-xs text-destructive">{state.fieldErrors.startLocal[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="endLocal" className="text-xs font-semibold">
                End Time (Asia/Colombo)
              </Label>
              <input
                id="endLocal"
                name="endLocal"
                type="datetime-local"
                step="900"
                required
                disabled={isPending}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              {state.fieldErrors?.endLocal?.[0] && (
                <p className="text-xs text-destructive">{state.fieldErrors.endLocal[0]}</p>
              )}
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-1.5">
            <Label htmlFor="purpose" className="text-xs font-semibold">
              Purpose / Meeting Subject
            </Label>
            <Textarea
              id="purpose"
              name="purpose"
              rows={3}
              placeholder="e.g. Quarterly architecture review & sprint retrospective"
              required
              disabled={isPending}
              className="resize-none text-sm"
            />
            {state.fieldErrors?.purpose?.[0] && (
              <p className="text-xs text-destructive">{state.fieldErrors.purpose[0]}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Between 3 and 200 characters.
            </p>
          </div>
        </CardContent>

        <CardFooter className="pt-2 border-t flex justify-end">
          <Button type="submit" disabled={isPending} className="min-w-32">
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Confirming...
              </span>
            ) : (
              `Reserve ${resourceName}`
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
