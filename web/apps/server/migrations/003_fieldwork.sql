CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_number TEXT NOT NULL,
  class_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_students_group_number ON students (group_number);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  zone TEXT NOT NULL,
  type TEXT NOT NULL,
  data_json TEXT NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_student_zone ON submissions (student_id, zone);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON submissions (type);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

INSERT OR IGNORE INTO teachers (id, username, password_hash)
VALUES ('teacher-default', 'teacher', '$2b$10$O/PQpvIqBZjBisrLWsZzNeYGzrcs3Zn3X8oWWqI3c.LFUb3SANMyS');
