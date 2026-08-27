-- Keep the most recent submission for each fixed student identity, zone and task.
DELETE FROM submissions
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY student_id, zone, type
        ORDER BY submitted_at DESC, id DESC
      ) AS row_number
    FROM submissions
  ) ranked
  WHERE ranked.row_number = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_student_zone_type
  ON submissions (student_id, zone, type);
