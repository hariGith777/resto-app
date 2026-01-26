import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

/**
 * Get restaurant details by ID
 * GET /super-admin/restaurants/{id}
 * 
 * Returns complete restaurant information with branch and staff counts
 * Available for SUPER_ADMIN only
 */
export const handler = async ({ headers, pathParameters }) => {
  try {
    // Verify authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = await verifyToken(token);

    // Only SUPER_ADMIN can access
    if (payload.role !== 'SUPER_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Super admin access required' }) };
    }

    const { id } = pathParameters;
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Restaurant ID required" }) };
    }

    // Get restaurant details with counts
    const result = await db.query(
      `SELECT 
         r.id,
         r.name,
         r.logo_url,
         r.primary_color,
         r.secondary_color,
         r.is_active,
         r.created_at,
         r.updated_at,
         COUNT(DISTINCT b.id) as branch_count,
         COUNT(DISTINCT s.id) as staff_count
       FROM restaurants r
       LEFT JOIN branches b ON r.id = b.restaurant_id
       LEFT JOIN staff s ON b.id = s.branch_id
       WHERE r.id = $1
       GROUP BY r.id, r.name, r.logo_url, r.primary_color, r.secondary_color, r.is_active, r.created_at, r.updated_at`,
      [id]
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Restaurant not found" }) };
    }

    const restaurant = result.rows[0];

    // Get branches for this restaurant
    const branchesResult = await db.query(
      `SELECT 
         b.id,
         b.name,
         b.address,
         b.country,
         b.currency_code,
         b.currency_symbol,
         b.is_active,
         b.created_at,
         COUNT(DISTINCT s.id) as staff_count,
         COUNT(DISTINCT a.id) as area_count
       FROM branches b
       LEFT JOIN staff s ON b.id = s.branch_id AND s.is_active = true
       LEFT JOIN areas a ON b.id = a.branch_id AND a.is_active = true
       WHERE b.restaurant_id = $1
       GROUP BY b.id, b.name, b.address, b.country, b.currency_code, b.currency_symbol, b.is_active, b.created_at
       ORDER BY b.created_at ASC`,
      [id]
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          logoUrl: restaurant.logo_url,
          primaryColor: restaurant.primary_color,
          secondaryColor: restaurant.secondary_color,
          isActive: restaurant.is_active,
          createdAt: restaurant.created_at,
          updatedAt: restaurant.updated_at,
          stats: {
            branchCount: parseInt(restaurant.branch_count),
            staffCount: parseInt(restaurant.staff_count)
          },
          branches: branchesResult.rows.map(branch => ({
            id: branch.id,
            name: branch.name,
            address: branch.address,
            country: branch.country,
            currency: {
              code: branch.currency_code,
              symbol: branch.currency_symbol
            },
            isActive: branch.is_active,
            createdAt: branch.created_at,
            stats: {
              staffCount: parseInt(branch.staff_count),
              areaCount: parseInt(branch.area_count)
            }
          }))
        }
      })
    };
  } catch (error) {
    console.error('Get restaurant error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
