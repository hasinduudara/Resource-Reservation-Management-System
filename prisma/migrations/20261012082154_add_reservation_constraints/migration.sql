-- Enable btree_gist extension to support GiST indexing on UUID and standard scalar types alongside ranges
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Ensure that a reservation's end time is strictly after its start time
ALTER TABLE reservations
  ADD CONSTRAINT reservations_valid_range CHECK (end_time > start_time);

-- Ensure state consistency: CANCELLED reservations must record cancelled_at, whereas CONFIRMED reservations must not
ALTER TABLE reservations
  ADD CONSTRAINT reservations_cancel_consistency CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
    OR (status = 'CONFIRMED' AND cancelled_at IS NULL)
  );

-- Prevent temporal overlaps among CONFIRMED reservations for the same resource using an exclusion constraint
ALTER TABLE reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status = 'CONFIRMED');