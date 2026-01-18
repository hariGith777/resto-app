import { verifyToken } from "../../common/auth.js";

/**
 * Generate menu item description using AI
 * POST /admin/menu/generate-description
 * Body: { itemName: string, foodType: string, tags?: string[] }
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

    const { itemName, foodType, tags } = JSON.parse(body || '{}');
    
    if (!itemName) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'itemName is required' }) 
      };
    }

    // TODO: Integrate with actual AI service (OpenAI, Anthropic, etc.)
    // For now, generate a template-based description
    
    const description = generateDescription(itemName, foodType, tags);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        description,
        generated: true,
        note: 'AI-generated description. Feel free to edit and customize.'
      })
    };
  } catch (error) {
    console.error('Generate description error:', error);
    console.error('Error stack:', error.stack);
    if (error.message === 'Missing token' || error.name === 'JsonWebTokenError') {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error', details: error.message }) };
  }
};

// Template-based description generator (replace with actual AI later)
function generateDescription(itemName, foodType, tags = []) {
  const descriptions = {
    VEG: [
      `A delightful vegetarian dish featuring ${itemName.toLowerCase()}.`,
      `Fresh and flavorful ${itemName.toLowerCase()} prepared with aromatic herbs and spices.`,
      `Our signature vegetarian ${itemName.toLowerCase()}, made with the finest ingredients.`
    ],
    NON_VEG: [
      `Succulent ${itemName.toLowerCase()} cooked to perfection with authentic spices.`,
      `Premium quality ${itemName.toLowerCase()} marinated and grilled to bring out rich flavors.`,
      `Tender ${itemName.toLowerCase()} prepared with a blend of traditional spices.`
    ],
    EGG: [
      `Delicious ${itemName.toLowerCase()} made with farm-fresh eggs.`,
      `Protein-rich ${itemName.toLowerCase()} prepared with fluffy eggs and aromatic seasonings.`,
      `Our special ${itemName.toLowerCase()} featuring perfectly cooked eggs.`
    ]
  };

  const baseDescriptions = descriptions[foodType] || descriptions.VEG;
  let description = baseDescriptions[Math.floor(Math.random() * baseDescriptions.length)];

  // Add tag-based enhancements
  if (tags && tags.length > 0) {
    if (tags.includes('Spicy')) {
      description += ' With a kick of heat for spice lovers.';
    }
    if (tags.includes("Chef's Special")) {
      description += " A chef's special that showcases our culinary expertise.";
    }
    if (tags.includes('Halal')) {
      description += ' Prepared following halal standards.';
    }
  }

  return description;
}
