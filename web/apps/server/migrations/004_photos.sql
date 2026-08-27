CREATE TABLE IF NOT EXISTS fieldwork_photos (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  zone TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  download_url TEXT NOT NULL,
  storage_file_id TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fp_student ON fieldwork_photos (student_id);
CREATE INDEX IF NOT EXISTS idx_fp_zone ON fieldwork_photos (zone);
