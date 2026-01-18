import { verifyToken } from "../../common/auth.js";

/**
 * Suggest tags for menu item using AI
 * POST /admin/menu/suggest-tags
 * Body: { itemName: string, description?: string, foodType: string }
 */
export const handler = async (event) => {
  try {
    const { body, headers } = event;
    
    // Verify admin authentication
    const token = headers?.authorization || headers?.Authorization;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authorization token required' }) };
    }

    const payload = verifyToken(token);
    
    if (payload.role !== 'RESTAURANT_ADMIN') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const { itemName, description, foodType } = JSON.parse(body || '{}');
    
    if (!itemName) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'itemName is required' }) 
      };
    }

    // TODO: Integrate with actual AI service for intelligent tag suggestions
    // For now, use keyword-based logic
    
    const suggestedTags = generateTags(itemName, description, foodType);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        tags: suggestedTags,
        generated: true,
        note: 'AI-suggested tags. Select the ones that apply.'
      })
    };
  } catch (error) {
    console.error('Suggest tags error:', error);
    console.error('Error stack:', error.stack);
    if (error.message === 'Missing token' || error.name === 'JsonWebTokenError') {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error', details: error.message }) };
  }
};

// Keyword-based tag generator (replace with actual AI later)
function generateTags(itemName, description = '', foodType) {
  const tags = [];
  const combinedText = `${itemName} ${description}`.toLowerCase();

  // Common tag database
  const tagKeywords = {
    'Spicy': ['spicy', 'hot', 'chili', 'pepper', 'masala', 'vindaloo', 'jalapeño'],
    "Chef's Special": ['special', 'signature', 'recommended', 'chef', 'house'],
    'Halal': ['halal', 'zabihah'],
    'Gluten-Free': ['gluten-free', 'gluten free', 'celiac'],
    'Dairy-Free': ['dairy-free', 'dairy free', 'vegan', 'plant-based'],
    'Bestseller': ['popular', 'favorite', 'bestseller', 'best seller'],
    'New': ['new', 'latest', 'fresh'],
    'Grilled': ['grilled', 'bbq', 'barbecue', 'tandoor', 'charcoal'],
    'Fried': ['fried', 'crispy', 'crunchy', 'deep-fried'],
    'Healthy': ['healthy', 'nutritious', 'low-fat', 'steamed', 'boiled'],
    'Creamy': ['creamy', 'rich', 'butter', 'cream', 'korma'],
    'Sweet': ['sweet', 'dessert', 'sugar', 'honey'],
    'Sour': ['sour', 'tangy', 'citrus', 'lemon'],
    'Vegetarian': ['vegetarian', 'veg', 'veggie'],
    'Vegan': ['vegan', 'plant-based'],
    'Contains Nuts': ['nuts', 'almond', 'cashew', 'peanut', 'walnut'],
    'Organic': ['organic', 'natural', 'farm-fresh'],
    'Keto-Friendly': ['keto', 'low-carb', 'high-protein']
  };

  // Check each tag against keywords
  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(keyword => combinedText.includes(keyword))) {
      tags.push(tag);
    }
  }

  // Add food type based tags
  if (foodType === 'VEG') {
    if (!tags.includes('Vegetarian')) tags.push('Vegetarian');
  }

  // Cuisine-based suggestions
  const cuisineKeywords = {
    'Indian': ['paneer', 'tikka', 'masala', 'biryani', 'curry', 'dal', 'naan', 'roti'],
    'Chinese': ['noodles', 'fried rice', 'manchurian', 'chilli', 'hakka'],
    'Continental': ['pasta', 'pizza', 'burger', 'sandwich', 'steak'],
    'Mexican': ['taco', 'burrito', 'quesadilla', 'nacho', 'salsa'],
    'Italian': ['pasta', 'pizza', 'risotto', 'ravioli', 'lasagna']
  };

  for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
    if (keywords.some(keyword => combinedText.includes(keyword))) {
      tags.push(cuisine);
      break; // Only add one cuisine tag
    }
  }

  // Return unique tags, limit to 5
  return [...new Set(tags)].slice(0, 5);
}
