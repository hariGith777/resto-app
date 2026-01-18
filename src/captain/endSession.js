import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

/**
 * End a table session
 * POST /captain/session/end
 * Body: { sessionId: string }
 * 
 * Called by captain or admin when customer pays and leaves
 * Sets session status to CLOSED and makes table available
 */
export const handler = async ({ body, headers }) => {
  try {
    const { sessionId } = JSON.parse(body || '{}');
    
    if (!sessionId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'sessionId is required' }) 
      };
    }

    // Verify staff authentication (captain/admin/staff only)
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Authorization token required' }) 
      };
    }

    let payload;
    try {
      payload = verifyToken(token.replace('Bearer ', ''));
    } catch (err) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid token' }) 
      };
    }
    
    // Only staff can end sessions (CAPTAIN, RESTAURANT_ADMIN, ADMIN, STAFF)
    if (!['CAPTAIN', 'RESTAURANT_ADMIN', 'ADMIN', 'STAFF'].includes(payload.role)) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Staff access required' }) 
      };
    }

    // Check if session exists and is not already closed
    const sessionCheck = await db.query(
      `SELECT ts.id, ts.table_id, ts.status, ts.started_at, ts.ended_at,
              t.table_number, a.name as area_name, a.branch_id
       FROM table_sessions ts
       JOIN tables t ON t.id = ts.table_id
       JOIN areas a ON a.id = t.area_id
       WHERE ts.id = $1`,
      [sessionId]
    );

    if (sessionCheck.rows.length === 0) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: 'Session not found' }) 
      };
    }

    const session = sessionCheck.rows[0];

    // Verify session belongs to staff's branch
    if (payload.branchId && session.branch_id !== payload.branchId) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Cannot access session from different branch' }) 
      };
    }

    if (session.status === 'CLOSED') {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          error: 'Session already closed',
          endedAt: session.ended_at
        }) 
      };
    }

    // Check if there are any pending orders (not COMPLETED/CANCELLED)
    const pendingOrders = await db.query(
      `SELECT COUNT(*) as pending_count
       FROM orders
       WHERE session_id = $1 
         AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [sessionId]
    );

    if (parseInt(pendingOrders.rows[0].pending_count) > 0) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ 
          error: 'Cannot end session with pending orders',
          pendingOrders: parseInt(pendingOrders.rows[0].pending_count),
          message: 'Please complete or cancel all orders before ending session'
        }) 
      };
    }

    // Close the session
    const result = await db.query(
      `UPDATE table_sessions
       SET status = 'CLOSED',
           ended_at = NOW()
       WHERE id = $1
       RETURNING id, status, started_at, ended_at`,
      [sessionId]
    );

    const endedSession = result.rows[0];

    // Calculate session duration
    const duration = new Date(endedSession.ended_at) - new Date(endedSession.started_at);
    const durationMinutes = Math.floor(duration / 1000 / 60);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Session closed successfully',
        sessionId: endedSession.id,
        status: endedSession.status,
        table: `${session.area_name} - Table ${session.table_number}`,
        startedAt: endedSession.started_at,
        endedAt: endedSession.ended_at,
        durationMinutes: durationMinutes,
        tableAvailable: true
      })
    };

  } catch (error) {
    console.error('End session error:', error);
    if (error.message === 'Missing token' || error.name === 'JsonWebTokenError') {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid token' }) 
      };
    }
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Internal server error', details: error.message }) 
    };
  }
};
