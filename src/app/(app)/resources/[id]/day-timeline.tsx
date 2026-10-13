import Link from "next/link";
import {
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
} from "@/lib/reservation-rules";
import { formatInAppTimezone, toUtc, getTodayInAppTimezone } from "@/lib/time";
import type { DayAvailabilityResult, AdminBookedSlot } from "@/services/availability";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DayTimelineProps {
  availability: DayAvailabilityResult;
  resourceId: string;
}

export function DayTimeline({ availability, resourceId }: DayTimelineProps) {
  const { date, booked, freeWindows } = availability;

  const todayStr = getTodayInAppTimezone();
  const isToday = date === todayStr;

  // Compute previous and next calendar day strings
  const dayStartUtc = toUtc(`${date} 00:00:00`);
  const prevDateStr = formatInAppTimezone(
    new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000),
    "yyyy-MM-dd"
  );
  const nextDateStr = formatInAppTimezone(
    new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000),
    "yyyy-MM-dd"
  );

  const formattedDateTitle = formatInAppTimezone(dayStartUtc, "EEEE, d MMMM yyyy");

  // Timeline metrics
  const totalHours = TIMELINE_END_HOUR - TIMELINE_START_HOUR; // 16 hours
  const totalMinutes = totalHours * 60; // 960 minutes
  const timelineStartMin = TIMELINE_START_HOUR * 60; // 360 min
  const timelineEndMin = TIMELINE_END_HOUR * 60; // 1320 min

  // Current time shading if today
  const now = new Date();
  const nowMin =
    parseInt(formatInAppTimezone(now, "HH"), 10) * 60 +
    parseInt(formatInAppTimezone(now, "mm"), 10);

  const pastEndMin = Math.min(timelineEndMin, Math.max(timelineStartMin, nowMin));
  const pastWidthPct = isToday
    ? Math.max(0, Math.min(100, ((pastEndMin - timelineStartMin) / totalMinutes) * 100))
    : 0;

  // Hour tick marks
  const hourTicks: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h += 2) {
    hourTicks.push(h);
  }

  return (
    <Card className="shadow-xs border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">Day Availability</CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Visual timeline from {TIMELINE_START_HOUR.toString().padStart(2, "0")}:00 to{" "}
              {TIMELINE_END_HOUR.toString().padStart(2, "0")}:00 (Asia/Colombo).
            </CardDescription>
          </div>

          {/* Date Picker & Nav Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/resources/${resourceId}?date=${prevDateStr}`}
              className={buttonVariants({ variant: "outline", size: "xs" })}
              title="Previous day"
            >
              ← Prev
            </Link>

            <Link
              href={`/resources/${resourceId}?date=${todayStr}`}
              className={buttonVariants({
                variant: isToday ? "default" : "outline",
                size: "xs",
              })}
            >
              Today
            </Link>

            <Link
              href={`/resources/${resourceId}?date=${nextDateStr}`}
              className={buttonVariants({ variant: "outline", size: "xs" })}
              title="Next day"
            >
              Next →
            </Link>

            {/* Direct date picker form */}
            <form method="GET" action={`/resources/${resourceId}`} className="inline-flex">
              <input
                type="date"
                name="date"
                defaultValue={date}
                className="h-7 text-xs rounded-md border border-input bg-background px-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button type="submit" variant="ghost" size="xs" className="ml-1 h-7 text-xs px-2">
                Go
              </Button>
            </form>
          </div>
        </div>

        <div className="pt-2">
          <span className="text-sm font-semibold text-foreground">
            {formattedDateTitle}
          </span>
          {isToday && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              Today
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Horizontal Visual Timeline Bar */}
        <div className="space-y-1.5">
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[640px] pt-2 pb-6 relative">
              {/* Timeline track container */}
              <div className="relative h-12 w-full rounded-md border bg-muted/30 overflow-hidden shadow-inner">
                {/* Past shaded area (for today) */}
                {isToday && pastWidthPct > 0 && (
                  <div
                    style={{ width: `${pastWidthPct}%` }}
                    className="absolute top-0 bottom-0 left-0 bg-muted/60 dark:bg-muted/80 border-r border-destructive/40"
                    title="Past time"
                  />
                )}

                {/* Booked blocks */}
                {booked.map((slot) => {
                  const startHours =
                    parseInt(formatInAppTimezone(slot.start, "HH"), 10) * 60 +
                    parseInt(formatInAppTimezone(slot.start, "mm"), 10);
                  const endHours =
                    parseInt(formatInAppTimezone(slot.end, "HH"), 10) * 60 +
                    parseInt(formatInAppTimezone(slot.end, "mm"), 10);

                  const visualStart = Math.max(timelineStartMin, Math.min(timelineEndMin, startHours));
                  const visualEnd = Math.max(timelineStartMin, Math.min(timelineEndMin, endHours));

                  if (visualEnd <= visualStart) return null;

                  const leftPct = ((visualStart - timelineStartMin) / totalMinutes) * 100;
                  const widthPct = Math.max(
                    0.5,
                    ((visualEnd - visualStart) / totalMinutes) * 100
                  );

                  const timeStr = `${formatInAppTimezone(slot.start, "HH:mm")} – ${formatInAppTimezone(slot.end, "HH:mm")}`;
                  const adminSlot = slot as AdminBookedSlot;
                  const tooltipText = adminSlot.userName
                    ? `${adminSlot.userName}: ${adminSlot.purpose || "Reserved"} (${timeStr})`
                    : `Reserved (${timeStr})`;

                  return (
                    <div
                      key={slot.id}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      title={tooltipText}
                      aria-label={tooltipText}
                      className={`absolute top-1 bottom-1 rounded flex items-center justify-center px-1 text-xs font-medium truncate shadow-xs transition-opacity ${
                        slot.isMine
                          ? "bg-primary text-primary-foreground border border-primary/80"
                          : "bg-rose-500/20 text-rose-800 dark:text-rose-200 border border-rose-500/40"
                      }`}
                    >
                      <span className="truncate text-[11px]">
                        {slot.isMine
                          ? "Yours"
                          : adminSlot.userName || "Reserved"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Hour Tick Markers */}
              <div className="relative w-full h-4 text-[10px] text-muted-foreground font-mono">
                {hourTicks.map((hour) => {
                  const leftPct = ((hour - TIMELINE_START_HOUR) / totalHours) * 100;
                  return (
                    <div
                      key={hour}
                      style={{ left: `${leftPct}%` }}
                      className="absolute -translate-x-1/2 pt-1 flex flex-col items-center"
                    >
                      <div className="h-1.5 w-px bg-border" />
                      <span>{hour.toString().padStart(2, "0")}:00</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Free Windows List with Quick-Book Pre-fill */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Available Free Windows
            </span>
            <span className="text-xs text-muted-foreground">
              {freeWindows.length} available
            </span>
          </div>

          {freeWindows.length === 0 ? (
            <div className="p-4 rounded-md border border-dashed bg-muted/20 text-center text-xs text-muted-foreground">
              No free time in the selected window for this day.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {freeWindows.map((fw, idx) => {
                const startStr = formatInAppTimezone(fw.start, "HH:mm");
                const endStr = formatInAppTimezone(fw.end, "HH:mm");

                const startIso = formatInAppTimezone(fw.start, "yyyy-MM-dd'T'HH:mm");
                // Cap booking duration at 8 hours max
                const maxEnd = new Date(
                  Math.min(fw.end.getTime(), fw.start.getTime() + 8 * 60 * 60 * 1000)
                );
                const endIso = formatInAppTimezone(maxEnd, "yyyy-MM-dd'T'HH:mm");

                const prefillUrl = `/resources/${resourceId}?date=${date}&start=${startIso}&end=${endIso}#booking-card`;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-md border bg-card text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-foreground">
                        {startStr} – {endStr}
                      </span>
                    </div>
                    <Link
                      href={prefillUrl}
                      className={buttonVariants({ variant: "outline", size: "xs" })}
                    >
                      Book
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Text-based Booked Slots (Accessibility & Clarity) */}
        {booked.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Booked Slots Summary
            </span>
            <div className="space-y-1.5">
              {booked.map((slot) => {
                const timeStr = `${formatInAppTimezone(slot.start, "HH:mm")} – ${formatInAppTimezone(slot.end, "HH:mm")}`;
                const adminSlot = slot as AdminBookedSlot;

                return (
                  <div
                    key={slot.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2 rounded border bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{timeStr}</span>
                      {slot.isMine && (
                        <Badge variant="default" className="text-[10px] h-4 px-1.5">
                          Yours
                        </Badge>
                      )}
                      {!slot.isMine && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                          {adminSlot.userName ? adminSlot.userName : "Reserved"}
                        </Badge>
                      )}
                    </div>
                    {adminSlot.purpose && (
                      <span className="text-muted-foreground truncate max-w-xs text-[11px]">
                        {adminSlot.purpose}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
