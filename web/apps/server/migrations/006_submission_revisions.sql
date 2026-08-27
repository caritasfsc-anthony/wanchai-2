CREATE TABLE IF NOT EXISTS submission_revisions (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  zone TEXT NOT NULL,
  type TEXT NOT NULL,
  data_json TEXT NOT NULL,
  revised_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submission_revisions_submission ON submission_revisions(submission_id, revised_at, id);
CREATE INDEX IF NOT EXISTS idx_submission_revisions_student_zone_type ON submission_revisions(student_id, zone, type, revised_at, id);

INSERT INTO submission_revisions (id, submission_id, student_id, zone, type, data_json, revised_at)
SELECT lower(hex(randomblob(16))), s.id, s.student_id, s.zone, s.type, s.data_json, s.submitted_at
FROM submissions s
WHERE NOT EXISTS (
  SELECT 1 FROM submission_revisions r WHERE r.submission_id = s.id
);
