-- Historical pre-normalization schema, retained only to test migration compatibility.

PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  address INTEGER NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  address_space TEXT NOT NULL,
  start INTEGER NOT NULL,
  "end" INTEGER NOT NULL,
  classification TEXT NOT NULL,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS analysis (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  address_space TEXT,
  address INTEGER,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS runtime (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  architecture TEXT NOT NULL,
  count INTEGER NOT NULL,
  address_space TEXT,
  address INTEGER,
  start INTEGER,
  "end" INTEGER,
  from_address_space TEXT,
  from_address INTEGER,
  to_address_space TEXT,
  to_address INTEGER,
  instruction_address_space TEXT,
  instruction_address INTEGER,
  accessed_address_space TEXT,
  accessed_address INTEGER,
  coverage TEXT,
  evidence TEXT NOT NULL,
  payload TEXT
) WITHOUT ROWID;
