import pkg from 'pg';
const { Pool } = pkg;

// Config
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.exjztcguwxtmdpzmwgxc:azLJKyqgJnf4xRGS@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=disable&pgbouncer=true';
const pool = new Pool({ connectionString: DATABASE_URL });

// Import handler
import { handler as getOrder } from './src/public/order/getOrder.js';

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function seedSessionWithOrders() {
  return withClient(async (client) => {
    const tableRes = await client.query('SELECT id FROM tables LIMIT 1');
    if (!tableRes.rowCount) throw new Error('No tables available');
    const tableId = tableRes.rows[0].id;

    const sessionRes = await client.query(
      'INSERT INTO table_sessions(table_id, started_at) VALUES($1, now()) RETURNING id',
      [tableId]
    );
    const sessionId = sessionRes.rows[0].id;

    const menuRes = await client.query('SELECT id, base_price FROM menu_items LIMIT 1');
    if (!menuRes.rowCount) throw new Error('No menu items available');
    const menuItem = menuRes.rows[0];
    const price = Number(menuItem.base_price) || 100;

    const orderIds = [];
    for (let i = 1; i <= 2; i++) {
      const qty = i; // create two orders with qty 1 and 2
      const total = price * qty;
      const orderRes = await client.query(
        'INSERT INTO orders(session_id, customer_id, status, total_amount) VALUES($1, $2, $3, $4) RETURNING id',
        [sessionId, null, 'PLACED', total]
      );
      const orderId = orderRes.rows[0].id;
      orderIds.push(orderId);

      await client.query(
        'INSERT INTO order_items(order_id, menu_item_id, portion_id, qty, price) VALUES($1, $2, $3, $4, $5)',
        [orderId, menuItem.id, null, qty, price]
      );
    }

    return { sessionId, orderIds, price };
  });
}

async function cleanup({ sessionId, orderIds }) {
  await withClient(async (client) => {
    await client.query('DELETE FROM order_items WHERE order_id = ANY($1::uuid[])', [orderIds]);
    await client.query('DELETE FROM orders WHERE id = ANY($1::uuid[])', [orderIds]);
    await client.query('DELETE FROM table_sessions WHERE id = $1', [sessionId]);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const seeded = await seedSessionWithOrders();
  const { sessionId, orderIds } = seeded;

  try {
    console.log('\n🧪 Testing getOrder (single order by id)');
    const singleRes = await getOrder({ pathParameters: { orderId: orderIds[0] }, queryStringParameters: {} });
    assert(singleRes.statusCode === 200, `Expected 200, got ${singleRes.statusCode}`);
    const singleBody = JSON.parse(singleRes.body);
    assert(singleBody.id === orderIds[0], 'Single order id mismatch');
    assert(Array.isArray(singleBody.items) && singleBody.items.length === 1, 'Single order items missing');
    console.log('✅ Single order fetch passed');

    console.log('\n🧪 Testing getOrder (all orders by sessionId)');
    const sessionRes = await getOrder({ pathParameters: {}, queryStringParameters: { sessionId } });
    assert(sessionRes.statusCode === 200, `Expected 200, got ${sessionRes.statusCode}`);
    const sessionBody = JSON.parse(sessionRes.body);
    assert(Array.isArray(sessionBody.orders), 'Orders array missing');
    assert(sessionBody.orders.length >= 2, 'Expected at least 2 orders');
    const returnedIds = sessionBody.orders.map((o) => o.id);
    orderIds.forEach((id) => assert(returnedIds.includes(id), `Order ${id} not in session response`));
    sessionBody.orders.forEach((o) => {
      assert(Array.isArray(o.items), 'Order items missing');
      assert(o.items.length > 0, 'Order items empty');
    });
    console.log('✅ Session orders fetch passed');
  } finally {
    await cleanup(seeded);
    await pool.end();
  }
}

run().catch((err) => {
  console.error('❌ Tests failed:', err.message);
  process.exit(1);
});
