import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ body, headers }) => {
  try {
    // Verify admin authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = await verifyToken(token);
    
    // Only RESTAURANT_ADMIN can create menu items
    if (payload.role !== 'RESTAURANT_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    if (!payload.branchId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Branch context required' }) };
    }

    const { 
      categoryId, 
      name, 
      description, 
      basePrice, 
      foodType,  // 'VEG', 'NON_VEG', 'EGG'
      imageUrl,  // Uploaded image URL
      tags,  // Array: ['Spicy', 'Halal', 'Chef\'s Special']
      preparationTime,  // Minutes (optional)
      kitchenType,  // 'VEG_KITCHEN' or 'NON_VEG_KITCHEN'
      spiceLevel, 
      allergens, 
      isAvailable,
      portions  // Array of {label, basePrice, deliveryPrice, takeawayPrice}
    } = JSON.parse(body || '{}');
    
    if (!categoryId || !name || !basePrice) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'categoryId, name, and basePrice required' }) 
      };
    }

    // Validate foodType
    const validFoodTypes = ['VEG', 'NON_VEG', 'EGG'];
    if (foodType && !validFoodTypes.includes(foodType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'foodType must be VEG, NON_VEG, or EGG' })
      };
    }

    // Validate kitchenType if provided
    const validKitchenTypes = ['VEG_KITCHEN', 'NON_VEG_KITCHEN'];
    if (kitchenType && !validKitchenTypes.includes(kitchenType)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'kitchenType must be VEG_KITCHEN or NON_VEG_KITCHEN' })
      };
    }

    // Validate tags if provided
    if (tags && !Array.isArray(tags)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'tags must be an array' })
      };
    }

    // Verify category belongs to admin's branch
    const categoryCheck = await db.query(
      'SELECT id FROM menu_categories WHERE id = $1 AND branch_id = $2',
      [categoryId, payload.branchId]
    );

    if (categoryCheck.rowCount === 0) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Category not found or does not belong to your branch' }) 
      };
    }

    // Create menu item
    const result = await db.query(
      `INSERT INTO menu_items(
        category_id, name, description, base_price, 
        food_type, image_url, tags, preparation_time, kitchen_type,
        is_veg, spice_level, allergens, is_available
      )
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, category_id, name, description, base_price, 
                 food_type, image_url, tags, preparation_time, kitchen_type,
                 is_veg, spice_level, allergens, is_available, created_at`,
      [
        categoryId, 
        name, 
        description || null, 
        basePrice,
        foodType || 'VEG',
        imageUrl || null,
        tags || null,  // PostgreSQL array
        preparationTime || null,
        kitchenType || null,
        // Keep is_veg for backward compatibility (true for VEG and EGG)
        foodType === 'VEG' || foodType === 'EGG' || !foodType,
        spiceLevel || 'MEDIUM',
        allergens ? JSON.stringify(allergens) : null,
        isAvailable !== false
      ]
    );

    const menuItemId = result.rows[0].id;

    // Create portions/variations if provided
    if (portions && Array.isArray(portions) && portions.length > 0) {
      for (const portion of portions) {
        await db.query(
          `INSERT INTO menu_portions(menu_item_id, label, base_price, delivery_price, takeaway_price)
           VALUES($1, $2, $3, $4, $5)`,
          [
            menuItemId,
            portion.label || 'Regular',
            portion.basePrice || basePrice,
            portion.deliveryPrice || portion.basePrice || basePrice,
            portion.takeawayPrice || portion.basePrice || basePrice
          ]
        );
      }
    }

    // Get currency information for the response
    const currencyRes = await db.query(
      'SELECT currency_code, currency_symbol FROM branches WHERE id = $1',
      [payload.branchId]
    );
    const currency = currencyRes.rows[0] || { currency_code: 'INR', currency_symbol: '₹' };

    const menuItem = {
      ...result.rows[0],
      price: {
        amount: parseFloat(result.rows[0].base_price),
        currency: currency.currency_code,
        symbol: currency.currency_symbol,
        formatted: `${currency.currency_symbol}${result.rows[0].base_price}`
      }
    };

    console.log(`Menu item created: ${name} (${foodType || 'VEG'}) by admin ${payload.staffId}`);

    return {
      statusCode: 201,
      body: JSON.stringify({ 
        message: 'Menu item created successfully',
        menuItem
      })
    };
  } catch (error) {
    console.error('Create menu item error:', error);
    if (error.message === 'Missing token' || error.name === 'JsonWebTokenError') {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
