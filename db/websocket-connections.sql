-- WebSocket Connections Table
-- Stores active WebSocket connections for real-time notifications

CREATE TABLE IF NOT EXISTS websocket_connections (
  connection_id TEXT PRIMARY KEY,
  staff_id UUID REFERENCES staff(id),
  branch_id UUID REFERENCES branches(id),
  connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('KITCHEN', 'CAPTAIN', 'ADMIN')),
  connected_at TIMESTAMP DEFAULT now(),
  last_ping_at TIMESTAMP DEFAULT now()
);

-- Index for fast lookup by branch and type
CREATE INDEX IF NOT EXISTS idx_ws_connections_branch_type 
ON websocket_connections(branch_id, connection_type);

-- Cleanup old connections (run periodically)
-- DELETE FROM websocket_connections WHERE last_ping_at < NOW() - INTERVAL '1 hour';
