import { db } from "../common/db.js";
import { requireRole } from "../common/auth.js";

export const handler = async (event, _, { db: dbHelper }) => {
  try {
    const token = event.headers && (event.headers.authorization || event.headers.Authorization);
    requireRole(token, 'SUPER_ADMIN');

    const { name, logoUrl, primaryColor, secondaryColor, branches } = JSON.parse(event.body);

    // Run as transaction: create restaurant -> create branches with managers
    const client = await (dbHelper || db).pool.connect();
    try {
      await client.query('BEGIN');

      const restaurantRes = await client.query(
        `INSERT INTO restaurants(name,logo_url,primary_color,secondary_color)
         VALUES($1,$2,$3,$4) RETURNING id`,
        [name, logoUrl || null, primaryColor || null, secondaryColor || null]
      );
      const restaurantId = restaurantRes.rows[0].id;

      const createdBranches = [];

      // Create branches if provided
      if (branches && Array.isArray(branches)) {
        for (const branch of branches) {
          const branchRes = await client.query(
            `INSERT INTO branches(
              restaurant_id, name, address, country, currency_code, currency_symbol,
              timezone, date_format, time_format, language, phone_country_code,
              tax_rate, service_charge_rate
            )
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
            [
              restaurantId, 
              branch.name, 
              branch.address || null,
              branch.country || 'India',
              branch.currencyCode || 'INR',
              branch.currencySymbol || '₹',
              branch.timezone || 'Asia/Kolkata',
              branch.dateFormat || 'DD/MM/YYYY',
              branch.timeFormat || '12h',
              branch.language || 'en',
              branch.phoneCountryCode || '+91',
              branch.taxRate || 0,
              branch.serviceChargeRate || 0
            ]
          );
          const branchId = branchRes.rows[0].id;

          let managerId = null;
          if (branch.manager) {
            const staffRes = await client.query(
              `INSERT INTO staff(branch_id,name,username,role,phone)
               VALUES($1,$2,$3,'RESTAURANT_ADMIN',$4) RETURNING id`,
              [branchId, branch.manager.name, branch.manager.username || null, branch.manager.phone || null]
            );
            managerId = staffRes.rows[0].id;
          }

          createdBranches.push({ branchId, managerId });
        }
      }

      await client.query('COMMIT');
      return { 
        statusCode: 201, 
        body: JSON.stringify({ restaurantId, branches: createdBranches }) 
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create restaurant error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || 'Internal server error' }) };
  }
};
