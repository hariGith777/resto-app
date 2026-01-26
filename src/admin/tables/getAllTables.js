import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

/**
 * Get all tables in staff's branch with their current status
 * GET /admin/all-tables
 * 
 * Returns all tables whether they have active sessions or not
 * Shows table number, area, capacity, and current session status
 * Available for CAPTAIN, STAFF, and RESTAURANT_ADMIN roles
 */
export const handler = async ({ headers }) => {
  try {
    // Verify captain authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = await verifyToken(token);

    // Only CAPTAIN and RESTAURANT_ADMIN can access
    if (!['CAPTAIN', 'RESTAURANT_ADMIN', 'STAFF'].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Staff access required' }) };
    }

    if (!payload.branchId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Branch ID not found in token" }) };
    }

    // Get all tables in the branch with their current session status
    const result = await db.query(
      `SELECT 
         t.id as table_id,
         t.table_number,
         t.capacity,
         t.qr_code,
         t.is_active as table_is_active,
         a.id as area_id,
         a.name as area_name,
         ts.id as session_id,
         ts.status as session_status,
         ts.started_at as session_started_at,
         ts.customer_phone,
         COALESCE(
           (SELECT COUNT(*) 
            FROM orders o 
            WHERE o.session_id = ts.id 
            AND o.status IN ('PLACED', 'PREPARING', 'READY')
           ), 0
         ) as active_orders_count,
         COALESCE(
           (SELECT SUM(oi.quantity * oi.price)
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            WHERE o.session_id = ts.id
           ), 0
         ) as total_amount
       FROM tables t
       JOIN areas a ON a.id = t.area_id
       LEFT JOIN table_sessions ts ON ts.table_id = t.id 
         AND ts.status = 'ACTIVE'
       WHERE a.branch_id = $1
       ORDER BY a.name, t.table_number`,
      [payload.branchId]
    );

    // Group tables by area
    const areaMap = new Map();
    
    result.rows.forEach(row => {
      const areaKey = row.area_id;
      
      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, {
          areaId: row.area_id,
          areaName: row.area_name,
          tables: []
        });
      }

      const table = {
        tableId: row.table_id,
        tableNumber: row.table_number,
        capacity: row.capacity,
        qrCode: row.qr_code,
        isActive: row.table_is_active,
        status: row.session_id ? 'OCCUPIED' : 'AVAILABLE',
        session: row.session_id ? {
          sessionId: row.session_id,
          status: row.session_status,
          startedAt: row.session_started_at,
          customerPhone: row.customer_phone,
          activeOrdersCount: parseInt(row.active_orders_count),
          totalAmount: parseFloat(row.total_amount)
        } : null
      };

      areaMap.get(areaKey).tables.push(table);
    });

    // Convert map to array
    const areas = Array.from(areaMap.values());

    // Calculate summary stats
    const totalTables = result.rows.length;
    const occupiedTables = result.rows.filter(r => r.session_id).length;
    const availableTables = totalTables - occupiedTables;

    return {
      statusCode: 200,
      body: JSON.stringify({
        summary: {
          totalTables,
          occupiedTables,
          availableTables
        },
        areas
      })
    };
  } catch (error) {
    console.error('Get captain tables error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
