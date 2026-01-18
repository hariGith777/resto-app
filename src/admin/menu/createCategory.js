import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ body, headers }) => {
  try {
    // Verify admin authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = verifyToken(token);
    
    // Only RESTAURANT_ADMIN can create categories
    if (payload.role !== 'RESTAURANT_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    if (!payload.branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Branch context required' }) };
    }

    const { name, displayOrder, isActive } = JSON.parse(body || '{}');
    
    if (!name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Category name required' }) };
    }

    // Create category for admin's branch
    const result = await db.query(
      `INSERT INTO menu_categories(branch_id, name, display_order, is_active)
       VALUES($1, $2, $3, $4)
       RETURNING id, branch_id, name, display_order, is_active`,
      [payload.branchId, name, displayOrder || 0, isActive !== false]
    );

    console.log(`Category created: ${name} by admin ${payload.staffId}`);

    return {
      statusCode: 201,
      body: JSON.stringify({ 
        message: 'Category created successfully',
        category: result.rows[0]
      })
    };
  } catch (error) {
    console.error('Create category error:', error);
    if (error.message === 'Missing token' || error.name === 'JsonWebTokenError') {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
