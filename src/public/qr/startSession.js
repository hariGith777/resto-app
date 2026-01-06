import { db } from '../../common/db.js';

export const handler = async ({ body }) => {
  try {
    const { tableId } = JSON.parse(body || '{}');
    if (!tableId) return { statusCode: 400, body: JSON.stringify({ error: 'tableId required' }) };

    // Check if an active session already exists for this table
    const existingSession = await db.query(
      `SELECT id FROM table_sessions 
       WHERE table_id = $1 AND ended_at IS NULL 
       ORDER BY started_at DESC LIMIT 1`,
      [tableId]
    );

    if (existingSession.rowCount > 0) {
      // Reuse existing session (another customer at same table)
      const sessionId = existingSession.rows[0].id;
      console.log(`Reusing existing session for table ${tableId}: ${sessionId}`);
      return { statusCode: 200, body: JSON.stringify({ sessionId, isNew: false }) };
    }

    // validate table exists and derive branch via area
    const t = await db.query(
      'SELECT t.id, a.branch_id FROM tables t JOIN areas a ON a.id = t.area_id WHERE t.id=$1 AND (t.is_active IS NULL OR t.is_active = true) LIMIT 1',
      [tableId]
    );
    if (!t.rowCount) return { statusCode: 404, body: JSON.stringify({ error: 'Table not found or inactive' }) };

    const branchId = t.rows[0].branch_id || null;
    const insert = await db.query('INSERT INTO table_sessions(table_id) VALUES($1) RETURNING id', [tableId]);
    const sessionId = insert.rows[0].id;
    console.log(`Created new session for table ${tableId}: ${sessionId}`);
    return { statusCode: 201, body: JSON.stringify({ sessionId, isNew: true }) };
  } catch (error) {
    console.error('Start session error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
