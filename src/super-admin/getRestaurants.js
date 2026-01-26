import { db } from '../common/db.js';
import { verifyToken } from '../common/auth.js';

export const handler = async ({ headers, queryStringParameters }) => {
  try {
    const auth = headers && (headers.authorization || headers.Authorization);
    if (!auth) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Missing authorization' }) 
      };
    }

    let payload;
    try {
      payload = await verifyToken(auth);
    } catch (e) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: 'Invalid token' }) 
      };
    }

    if (payload.role !== 'SUPER_ADMIN') {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Super admin access required' }) 
      };
    }

    // Optional filters
    const { status, search, limit = '50', offset = '0' } = queryStringParameters || {};

    let query = `
      SELECT 
        r.id,
        r.name,
        r.status,
        r.created_at,
        COUNT(DISTINCT b.id) as branch_count,
        COUNT(DISTINCT s.id) as staff_count
      FROM restaurants r
      LEFT JOIN branches b ON r.id = b.restaurant_id
      LEFT JOIN staff s ON b.id = s.branch_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND r.name ILIKE $${paramCount}`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += `
      GROUP BY r.id, r.name, r.status, r.created_at
      ORDER BY r.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM restaurants WHERE 1=1';
    const countParams = [];
    let countParamIdx = 1;

    if (status) {
      countQuery += ` AND status = $${countParamIdx}`;
      countParams.push(status);
      countParamIdx++;
    }

    if (search) {
      countQuery += ` AND name ILIKE $${countParamIdx}`;
      countParams.push(`%${search}%`);
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    return {
      statusCode: 200,
      body: JSON.stringify({
        restaurants: result.rows,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + result.rows.length) < total
        }
      })
    };
  } catch (err) {
    console.error('Get restaurants error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch restaurants', details: err.message })
    };
  }
};
