-- 菜谱
CREATE TABLE dishes (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT,
  photo        TEXT,                              -- /api/photos/<key>
  ingredients  TEXT,
  steps        TEXT,
  notes        TEXT,
  available    INTEGER NOT NULL DEFAULT 1,        -- 0 = 今日估清
  difficulty   INTEGER NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  favorite     INTEGER NOT NULL DEFAULT 0,
  cook_minutes INTEGER,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_dishes_created_at ON dishes (created_at DESC);

-- 订单
CREATE TABLE orders (
  id         TEXT PRIMARY KEY,
  items      TEXT NOT NULL,                       -- JSON: [{dish_id, name, qty}]
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'cooking', 'done', 'cancelled')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);
