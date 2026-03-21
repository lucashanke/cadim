CREATE TABLE pluggy_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pluggy_item_id TEXT NOT NULL,
    connector_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pluggy_items_user ON pluggy_items(user_id);
CREATE UNIQUE INDEX idx_pluggy_items_user_item ON pluggy_items(user_id, pluggy_item_id);
