import { db } from "../common/db.js";
import { requireRole } from "../common/auth.js";

export const handler = async (event) => {
  try {
    const token = event.headers && (event.headers.authorization || event.headers.Authorization);
    requireRole(token, 'SUPER_ADMIN');

    const { 
      restaurantId,
      name, 
      address, 
      country, 
      currencyCode, 
      currencySymbol,
      timezone,
      dateFormat,
      timeFormat,
      language,
      phoneCountryCode,
      taxRate,
      serviceChargeRate,
      manager 
    } = JSON.parse(event.body);

    if (!restaurantId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Restaurant ID is required' }) };
    }

    if (!name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Branch name is required' }) };
    }

    // Verify restaurant exists
    const restaurantCheck = await db.query(
      'SELECT id FROM restaurants WHERE id = $1',
      [restaurantId]
    );

    if (restaurantCheck.rows.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Restaurant not found' }) };
    }

    // Create the new branch in a transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const branchRes = await client.query(
        `INSERT INTO branches(
          restaurant_id, name, address, country, currency_code, currency_symbol,
          timezone, date_format, time_format, language, phone_country_code,
          tax_rate, service_charge_rate
        )
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          restaurantId,
          name,
          address || null,
          country || 'India',
          currencyCode || 'INR',
          currencySymbol || '₹',
          timezone || 'Asia/Kolkata',
          dateFormat || 'DD/MM/YYYY',
          timeFormat || '12h',
          language || 'en',
          phoneCountryCode || '+91',
          taxRate || 0,
          serviceChargeRate || 0
        ]
      );

      const branchId = branchRes.rows[0].id;
      let managerId = null;

      // Create manager if provided
      if (manager && manager.name) {
        const staffRes = await client.query(
          `INSERT INTO staff(branch_id, name, username, role, phone, is_active)
           VALUES($1, $2, $3, 'RESTAURANT_ADMIN', $4, true) RETURNING id`,
          [
            branchId,
            manager.name,
            manager.username || null,
            manager.phone || null
          ]
        );
        managerId = staffRes.rows[0].id;
      }

      await client.query('COMMIT');

      console.log(`Branch created: ${name} (${branchId}) by super admin`);

      return {
        statusCode: 201,
        body: JSON.stringify({
          branchId,
          managerId,
          message: 'Branch created successfully'
        })
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create branch error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message || 'Internal server error' }) 
    };
  }
};
