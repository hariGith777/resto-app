import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

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
        const payload = verifyToken(token);
        customerId = payload.customerId || null;
      } catch (error) {
        // Token invalid or missing - continue without customer_id (captain orders)
        console.log('No valid customer token, order will be placed without customer_id');
      }
    }

    // Validate session exists
    const sessionRes = await db.query("SELECT id FROM table_sessions WHERE id = $1", [sessionId]);
    if (!sessionRes.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Session not found" }) };
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
        [orderId, "SENT"]
      );

      await client.query("COMMIT");

      return {
        statusCode: 201,
        body: JSON.stringify({
          orderId,
          totalAmount,
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
