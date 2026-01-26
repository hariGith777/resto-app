import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";
import { broadcastToKitchen } from "../../common/websocket.js";
import { validateSessionOpen } from "../../common/sessionValidator.js";

export const handler = async ({ body, queryStringParameters, headers }) => {
  try {
    const { sessionId } = queryStringParameters || {};
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: "sessionId required" }) };
    }

    const { items } = JSON.parse(body || "{}");
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "items array required" }) };
    }

    // Extract customer_id from JWT token (optional - for customer self-orders)
    let customerId = null;
    const token = headers?.authorization || headers?.Authorization;
    if (token) {
      try {
        const payload = await verifyToken(token);
        customerId = payload.customerId || null;
      } catch (error) {
        // Token invalid or missing - continue without customer_id (captain orders)
        console.log('No valid customer token, order will be placed without customer_id');
      }
    }

    // Validate session exists and is OPEN
    try {
      await validateSessionOpen(sessionId);
    } catch (error) {
      if (error.message === 'SESSION_NOT_FOUND') {
        return { statusCode: 404, body: JSON.stringify({ error: "Session not found" }) };
      }
      if (error.message === 'SESSION_CLOSED') {
        return { statusCode: 403, body: JSON.stringify({ error: "Session is closed. Cannot place orders." }) };
      }
      throw error;
    }

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // Calculate total amount and validate items exist
      let totalAmount = 0;
      const orderItemsData = [];

      for (const item of items) {
        const { menuItemId, portionId, qty } = item;
        if (!menuItemId || !qty || qty <= 0) {
          await client.query("ROLLBACK");
          return { statusCode: 400, body: JSON.stringify({ error: "Invalid item format" }) };
        }

        // Fetch menu item details for snapshotting price
        let itemPrice;
        if (portionId) {
          const portionRes = await client.query(
            "SELECT price FROM menu_portions WHERE id = $1 AND menu_item_id = $2",
            [portionId, menuItemId]
          );
          if (!portionRes.rowCount) {
            await client.query("ROLLBACK");
            return { statusCode: 404, body: JSON.stringify({ error: `Portion ${portionId} not found` }) };
          }
          itemPrice = portionRes.rows[0].price;
        } else {
          const itemRes = await client.query(
            "SELECT base_price FROM menu_items WHERE id = $1",
            [menuItemId]
          );
          if (!itemRes.rowCount) {
            await client.query("ROLLBACK");
            return { statusCode: 404, body: JSON.stringify({ error: `Menu item ${menuItemId} not found` }) };
          }
          itemPrice = itemRes.rows[0].base_price;
        }

        const lineTotal = parseFloat(itemPrice) * qty;
        totalAmount += lineTotal;
        orderItemsData.push({ menuItemId, portionId: portionId || null, qty, price: itemPrice });
      }

      // Get currency information from branch
      const currencyRes = await client.query(
        `SELECT b.currency_code, b.currency_symbol
         FROM branches b
         JOIN areas a ON a.branch_id = b.id
         JOIN tables t ON t.area_id = a.id
         JOIN table_sessions ts ON ts.table_id = t.id
         WHERE ts.id = $1`,
        [sessionId]
      );
      const currency = currencyRes.rows[0] || { currency_code: 'INR', currency_symbol: '₹' };

      // Create order
      const orderRes = await client.query(
        `INSERT INTO orders(session_id, customer_id, status, total_amount)
         VALUES($1, $2, $3, $4) RETURNING id`,
        [sessionId, customerId, "PLACED", totalAmount]
      );
      const orderId = orderRes.rows[0].id;

      // Create order items
      for (const itemData of orderItemsData) {
        await client.query(
          `INSERT INTO order_items(order_id, menu_item_id, portion_id, qty, price)
           VALUES($1, $2, $3, $4, $5)`,
          [orderId, itemData.menuItemId, itemData.portionId, itemData.qty, itemData.price]
        );
      }

      // Create KOT
      await client.query(
        `INSERT INTO kots(order_id, status)
         VALUES($1, $2)`,
        [orderId, "PLACED"]
      );

      await client.query("COMMIT");

      // Broadcast new order to kitchen via WebSocket
      try {
        // Get branch_id from session
        const sessionBranchRes = await db.query(
          `SELECT a.branch_id FROM table_sessions ts
           JOIN tables t ON t.id = ts.table_id
           JOIN areas a ON a.id = t.area_id
           WHERE ts.id = $1`,
          [sessionId]
        );
        
        if (sessionBranchRes.rowCount > 0) {
          const branchId = sessionBranchRes.rows[0].branch_id;
          await broadcastToKitchen(branchId, {
            type: 'NEW_ORDER',
            orderId,
            totalAmount: {
              amount: totalAmount,
              currency: currency.currency_code,
              symbol: currency.currency_symbol,
              formatted: `${currency.currency_symbol}${totalAmount.toFixed(2)}`
            },
            itemCount: items.length,
            status: 'PLACED',
            timestamp: new Date().toISOString()
          });
        }
      } catch (wsError) {
        // Don't fail order if broadcast fails
        console.error('WebSocket broadcast error:', wsError);
      }

      return {
        statusCode: 201,
        body: JSON.stringify({
          orderId,
          totalAmount: {
            amount: totalAmount,
            currency: currency.currency_code,
            symbol: currency.currency_symbol,
            formatted: `${currency.currency_symbol}${totalAmount.toFixed(2)}`
          },
          itemCount: items.length,
          status: "PLACED"
        })
      };
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Place order error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
