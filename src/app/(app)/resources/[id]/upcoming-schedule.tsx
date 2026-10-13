import { formatInAppTimezone } from "@/lib/time";
import type { ResourceUpcomingSlot } from "@/services/reservations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UpcomingScheduleProps {
  slots: ResourceUpcomingSlot[];
}

interface GroupedDaySlots {
  dayLabel: string;
  slots: ResourceUpcomingSlot[];
}

export function UpcomingSchedule({ slots }: UpcomingScheduleProps) {
  // Group slots by day (in Asia/Colombo)
  const groupedByDay: GroupedDaySlots[] = [];

  slots.forEach((slot) => {
    const dayKey = formatInAppTimezone(slot.startTime, "EEEE, d MMMM yyyy");
    let group = groupedByDay.find((g) => g.dayLabel === dayKey);
    if (!group) {
      group = { dayLabel: dayKey, slots: [] };
      groupedByDay.push(group);
    }
    group.slots.push(slot);
  });

  return (
    <Card className="shadow-xs border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight">
              Upcoming Reservations
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Next 14 days schedule. Back-to-back bookings are supported.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-normal">
            {slots.length} booked
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {slots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground bg-muted/20">
            <svg
              className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-medium">No reservations in the next 14 days</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This resource has open availability over the coming two weeks.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByDay.map((group) => (
              <div key={group.dayLabel} className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.dayLabel}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.slots.map((slot) => {
                    const startStr = formatInAppTimezone(slot.startTime, "HH:mm");
                    const endStr = formatInAppTimezone(slot.endTime, "HH:mm");

                    return (
                      <div
                        key={slot.id}
                        className={`flex items-center justify-between p-2.5 rounded-md border text-sm transition-colors ${
                          slot.isMine
                            ? "bg-primary/5 border-primary/30"
                            : "bg-muted/40 border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">
                            {startStr} – {endStr}
                          </span>
                        </div>
                        {slot.isMine && (
                          <Badge
                            variant="default"
                            className="text-[10px] h-5 px-1.5 font-medium"
                          >
                            Yours
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
