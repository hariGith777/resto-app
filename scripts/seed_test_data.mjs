import dotenv from 'dotenv';
dotenv.config();

const dbModule = (await import('../src/libs/db.js')).default;

async function seed() {
  console.log('Starting fresh seed...');
  
  try {
    // Clear all data (respect foreign keys)
    console.log('Clearing existing data...');
    await dbModule.query('TRUNCATE TABLE subscription_usage, restaurant_subscriptions, plan_features, subscription_plans CASCADE');
    await dbModule.query('TRUNCATE TABLE ai_recommendation_context, customer_preferences, ai_interactions CASCADE');
    await dbModule.query('TRUNCATE TABLE payments, bills CASCADE');
    await dbModule.query('TRUNCATE TABLE ws_connections CASCADE');
    await dbModule.query('TRUNCATE TABLE kots, order_items, orders CASCADE');
    await dbModule.query('TRUNCATE TABLE menu_modifiers, menu_portions, menu_items, menu_categories CASCADE');
    await dbModule.query('TRUNCATE TABLE otp_requests, customers, customer_profiles, table_sessions CASCADE');
    await dbModule.query('TRUNCATE TABLE staff CASCADE');
    await dbModule.query('TRUNCATE TABLE tables, areas CASCADE');
    await dbModule.query('TRUNCATE TABLE branches CASCADE');
    await dbModule.query('TRUNCATE TABLE ai_knowledge_base CASCADE');
    await dbModule.query('TRUNCATE TABLE restaurants CASCADE');

    // 1. Create Restaurant
    console.log('Creating restaurant...');
    const r = await dbModule.query(
      'INSERT INTO restaurants(name, logo_url, primary_color, secondary_color) VALUES($1,$2,$3,$4) RETURNING id',
      ['Spice Villa', 'spice_villa.png', '#FF5722', '#4CAF50']
    );
    const restaurantId = r.rows[0].id;
    console.log('Restaurant created:', restaurantId);

    // 2. Create Branches
    console.log('Creating branches...');
    const b1 = await dbModule.query(
      'INSERT INTO branches(restaurant_id, name, address, is_active) VALUES($1,$2,$3,$4) RETURNING id',
      [restaurantId, 'Downtown Branch', '123 Main Street, City Center', true]
    );
    const branchId1 = b1.rows[0].id;

    const b2 = await dbModule.query(
      'INSERT INTO branches(restaurant_id, name, address, is_active) VALUES($1,$2,$3,$4) RETURNING id',
      [restaurantId, 'Mall Branch', '456 Shopping Plaza, Business District', true]
    );
    const branchId2 = b2.rows[0].id;
    console.log('Branches created:', branchId1, branchId2);

    // 3. Create Areas and Tables for each branch
    console.log('Creating areas and tables...');
    const areas = [];
    for (const [idx, branchId] of [branchId1, branchId2].entries()) {
      const a = await dbModule.query(
        'INSERT INTO areas(branch_id, name) VALUES($1,$2) RETURNING id',
        [branchId, `Ground Floor`]
      );
      const areaId = a.rows[0].id;
      areas.push({ branchId, areaId });

      // Create 4 tables per branch
      for (let t = 1; t <= 4; t++) {
        await dbModule.query(
          'INSERT INTO tables(area_id, table_number, capacity, is_active) VALUES($1,$2,$3,$4)',
          [areaId, `T${t}`, 4, true]
        );
      }
      console.log(`Branch ${idx + 1}: 1 area with 4 tables`);
    }

    // 4. Create Staff with different roles
    console.log('Creating staff...');
    // Super Admin
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [null, 'Admin User', 'admin', 'SUPER_ADMIN', '9000000000', true]
    );

    // Branch Managers
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [branchId1, 'Manager Downtown', 'manager_dt', 'RESTAURANT_ADMIN', '9111111111', true]
    );
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [branchId2, 'Manager Mall', 'manager_ml', 'RESTAURANT_ADMIN', '9222222222', true]
    );

    // Captains (waiters)
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [branchId1, 'Captain Raj', 'captain_raj', 'CAPTAIN', '9333333333', true]
    );
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [branchId1, 'Captain Priya', 'captain_priya', 'CAPTAIN', '9444444444', true]
    );
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [branchId2, 'Captain Arjun', 'captain_arjun', 'CAPTAIN', '9555555555', true]
    );

    // Kitchen Staff
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [branchId1, 'Chef Kumar', 'chef_kumar', 'KITCHEN', '9666666666', true]
    );
    await dbModule.query(
      'INSERT INTO staff(branch_id, name, username, role, phone, is_active) VALUES($1,$2,$3,$4,$5,$6)',
      [branchId2, 'Chef Meera', 'chef_meera', 'KITCHEN', '9777777777', true]
    );
    console.log('Staff created: 1 super admin, 2 managers, 3 captains, 2 chefs');

    // 5. Create Menu Categories (per branch)
    console.log('Creating menu...');
    const categories = {};
    
    for (const branchId of [branchId1, branchId2]) {
      const catRes = await dbModule.query(
        'INSERT INTO menu_categories(branch_id, name, display_order, is_active) VALUES($1,$2,$3,$4) RETURNING id',
        [branchId, 'Appetizers', 1, true]
      );
      const appetizerId = catRes.rows[0].id;

      const catRes2 = await dbModule.query(
        'INSERT INTO menu_categories(branch_id, name, display_order, is_active) VALUES($1,$2,$3,$4) RETURNING id',
        [branchId, 'Main Course', 2, true]
      );
      const mainCourseId = catRes2.rows[0].id;

      const catRes3 = await dbModule.query(
        'INSERT INTO menu_categories(branch_id, name, display_order, is_active) VALUES($1,$2,$3,$4) RETURNING id',
        [branchId, 'Desserts', 3, true]
      );
      const dessertsId = catRes3.rows[0].id;

      categories[branchId] = { appetizerId, mainCourseId, dessertsId };
    }

    // 6. Create Menu Items (for first branch only for demo)
    const { appetizerId, mainCourseId, dessertsId } = categories[branchId1];
    const items = [
      { categoryId: appetizerId, name: 'Samosa', description: 'Crispy triangular pastry with spiced filling', price: 45, veg: true, spice: 'MEDIUM' },
      { categoryId: appetizerId, name: 'Pakora', description: 'Battered and deep-fried vegetables', price: 60, veg: true, spice: 'MEDIUM' },
      { categoryId: appetizerId, name: 'Paneer Tikka', description: 'Grilled cottage cheese with spices', price: 120, veg: true, spice: 'HIGH' },
      
      { categoryId: mainCourseId, name: 'Butter Chicken', description: 'Tender chicken in creamy tomato sauce', price: 280, veg: false, spice: 'MEDIUM' },
      { categoryId: mainCourseId, name: 'Paneer Tikka Masala', description: 'Cottage cheese in aromatic tomato gravy', price: 220, veg: true, spice: 'MEDIUM' },
      { categoryId: mainCourseId, name: 'Biryani', description: 'Fragrant rice cooked with meat and spices', price: 240, veg: false, spice: 'HIGH' },
      { categoryId: mainCourseId, name: 'Vegetable Biryani', description: 'Fragrant rice with mixed vegetables', price: 180, veg: true, spice: 'MEDIUM' },
      
      { categoryId: dessertsId, name: 'Gulab Jamun', description: 'Sweet milk solids in sugar syrup', price: 80, veg: true, spice: 'LOW' },
      { categoryId: dessertsId, name: 'Kheer', description: 'Rice pudding with cardamom and nuts', price: 90, veg: true, spice: 'LOW' }
    ];

    for (const item of items) {
      await dbModule.query(
        'INSERT INTO menu_items(category_id, name, description, base_price, is_veg, spice_level, is_available) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [item.categoryId, item.name, item.description, item.price, item.veg, item.spice, true]
      );
    }
    console.log(`Menu created: 3 categories with ${items.length} items`);

    // 7. Add AI Knowledge Base
    console.log('Creating AI knowledge base...');
    const kbItems = [
      { topic: 'Vegetarian Options', content: 'We have a wide range of vegetarian dishes including paneer dishes, dal, vegetable curries, and rice preparations.' },
      { topic: 'Allergen Information', content: 'Our kitchen handles nuts, dairy, and gluten. Please inform staff of any allergies.' },
      { topic: 'Spice Levels', content: 'We offer mild, medium, and hot spice levels. Ask your server for recommendations.' },
      { topic: 'House Specialties', content: 'Our signature dishes are Butter Chicken and Paneer Tikka Masala.' }
    ];

    for (const kb of kbItems) {
      await dbModule.query(
        'INSERT INTO ai_knowledge_base(restaurant_id, topic, content, is_active) VALUES($1,$2,$3,$4)',
        [restaurantId, kb.topic, kb.content, true]
      );
    }
    console.log('AI knowledge base created');

    console.log('\n✓ Seed completed successfully!\n');
    console.log('Test Data Summary:');
    console.log('- Restaurant: Spice Villa');
    console.log('- Branches: 2 (Downtown, Mall)');
    console.log('- Areas & Tables: 1 area per branch with 4 tables each');
    console.log('- Staff: 9 total (1 admin, 2 managers, 3 captains, 2 chefs, 1 extra)');
    console.log('- Menu: 3 categories with 9 items');
    console.log('- AI KB: 4 topics\n');
    console.log('Test Credentials:');
    console.log('- Admin: username=admin');
    console.log('- Manager DT: username=manager_dt');
    console.log('- Captain: username=captain_raj, captain_priya (Downtown), captain_arjun (Mall)');
    console.log('- Chef: username=chef_kumar (Downtown), chef_meera (Mall)\n');

    await dbModule.pool.end?.();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    await dbModule.pool.end?.();
    process.exit(1);
  }
}

seed();
