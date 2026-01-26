import { db } from "../../common/db.js";
import { verifyToken } from "../../common/auth.js";

export const handler = async ({ pathParameters, body, headers }) => {
  try {
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: "Missing authorization" }) };
    }

    const payload = await verifyToken(token);
    if (!["ADMIN", "RESTAURANT_ADMIN"].includes(payload.role)) {
      return { statusCode: 403, body: JSON.stringify({ error: "Admin access required" }) };
    }

    const { id } = pathParameters;
    const { 
      name, description, basePrice, foodType, imageUrl, 
      tags, preparationTime, kitchenType, spiceLevel, 
      allergens, isAvailable 
    } = JSON.parse(body || '{}');

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (basePrice !== undefined) {
      updates.push(`base_price = $${paramCount++}`);
      values.push(basePrice);
    }
    if (foodType !== undefined) {
      updates.push(`food_type = $${paramCount++}`);
      values.push(foodType);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(imageUrl);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(tags);
    }
    if (preparationTime !== undefined) {
      updates.push(`preparation_time = $${paramCount++}`);
      values.push(preparationTime);
    }
    if (kitchenType !== undefined) {
      updates.push(`kitchen_type = $${paramCount++}`);
      values.push(kitchenType);
    }
    if (spiceLevel !== undefined) {
      updates.push(`spice_level = $${paramCount++}`);
      values.push(spiceLevel);
    }
    if (allergens !== undefined) {
      updates.push(`allergens = $${paramCount++}`);
      values.push(JSON.stringify(allergens));
    }
    if (isAvailable !== undefined) {
      updates.push(`is_available = $${paramCount++}`);
      values.push(isAvailable);
    }

    if (updates.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No fields to update" }) };
    }

    values.push(id);
    values.push(payload.branchId);
    
    const result = await db.query(
      `UPDATE menu_items mi
       SET ${updates.join(', ')}, updated_at = NOW()
       FROM menu_categories mc
       WHERE mi.id = $${paramCount} AND mi.category_id = mc.id AND mc.branch_id = $${paramCount + 1}
       RETURNING mi.*`,
      values
    );

    if (!result.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ error: "Menu item not found or access denied" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Menu item updated successfully",
        menuItem: result.rows[0]
      })
    };
  } catch (error) {
    console.error("Update menu item error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal server error", details: error.message }) };
  }
};
