import { db } from "../common/db.js";
import { verifyToken } from "../common/auth.js";

/**
 * Get branch details by ID
 * GET /admin/branches/{id}
 * 
 * Returns complete branch information including currency, timezone, and settings
 * Available for RESTAURANT_ADMIN and SUPER_ADMIN
 */
export const handler = async ({ headers, pathParameters }) => {
  try {
    // Verify authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = await verifyToken(token);

    // Only RESTAURANT_ADMIN and SUPER_ADMIN can access
    if (!['RESTAURANT_ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const { id } = pathParameters;
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ error: "Branch ID required" }) };
    }

    // If RESTAURANT_ADMIN, verify they have access to this branch
    if (payload.role === 'RESTAURANT_ADMIN' && payload.branchId !== id) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Access denied to this branch' }) };
    }

    // Get branch details
    const result = await db.query(
      `SELECT 
         b.id,
         b.restaurant_id,
         b.name,
         b.address,
         b.country,
         b.currency_code,
         b.currency_symbol,
         b.timezone,
         b.date_format,
         b.time_format,
         b.language,
         b.phone_country_code,
         b.tax_rate,
         b.service_charge_rate,
         b.is_active,
         b.created_at,
         b.updated_at,
         r.name as restaurant_name,
         r.logo_url as restaurant_logo,
         (SELECT COUNT(*) FROM staff WHERE branch_id = b.id AND is_active = true) as staff_count,
         (SELECT COUNT(*) FROM areas WHERE branch_id = b.id AND is_active = true) as area_count,
         (SELECT COUNT(*) FROM tables t JOIN areas a ON t.area_id = a.id WHERE a.branch_id = b.id AND t.is_active = true) as table_count
       FROM branches b
       LEFT JOIN restaurants r ON r.id = b.restaurant_id
       WHERE b.id = $1`,
      [id]
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Branch not found" }) };
    }

    const branch = result.rows[0];

    return {
      statusCode: 200,
      body: JSON.stringify({
        branch: {
          id: branch.id,
          restaurantId: branch.restaurant_id,
          restaurantName: branch.restaurant_name,
          restaurantLogo: branch.restaurant_logo,
          name: branch.name,
          address: branch.address,
          country: branch.country,
          currency: {
            code: branch.currency_code,
            symbol: branch.currency_symbol
          },
          timezone: branch.timezone,
          dateFormat: branch.date_format,
          timeFormat: branch.time_format,
          language: branch.language,
          phoneCountryCode: branch.phone_country_code,
          taxRate: parseFloat(branch.tax_rate),
          serviceChargeRate: parseFloat(branch.service_charge_rate),
          isActive: branch.is_active,
          stats: {
            staffCount: parseInt(branch.staff_count),
            areaCount: parseInt(branch.area_count),
            tableCount: parseInt(branch.table_count)
          },
          createdAt: branch.created_at,
          updatedAt: branch.updated_at
        }
      })
    };
  } catch (error) {
    console.error('Get branch error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
  }
};
