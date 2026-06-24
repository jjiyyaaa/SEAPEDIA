const http = require('http');

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING SEAPEDIA LEVEL 6 ADMIN & OVERDUE TESTS ===\n');

  try {
    const timestamp = Date.now();

    // 1. Setup Admin Account
    console.log('1. Setting up Admin Account...');
    const adminData = {
      username: `admin_${timestamp}`,
      email: `admin_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['ADMIN']
    };
    await request('POST', '/api/auth/register', adminData);
    const loginAdmin = await request('POST', '/api/auth/login', { username: adminData.username, password: adminData.password });
    const adminToken = loginAdmin.body.token;
    console.log('✓ Admin account registered & logged in.\n');

    // Reset simulation offset to start fresh
    await request('POST', '/api/admin/reset-simulation', null, { 'Authorization': `Bearer ${adminToken}` });

    // 2. Setup Seller & Product
    console.log('2. Setting up Seller Store & Product...');
    const sellerData = {
      username: `s_lv6_${timestamp}`,
      email: `s_lv6_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    await request('POST', '/api/auth/register', sellerData);
    const loginS = await request('POST', '/api/auth/login', { username: sellerData.username, password: sellerData.password });
    const sToken = loginS.body.token;
    await request('POST', '/api/seller/store', { name: `Lv6 Store ${timestamp}` }, { 'Authorization': `Bearer ${sToken}` });
    const prodRes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Sardines Cargo', description: 'Fresh seafood', price: 50000, stock: 10 },
      { 'Authorization': `Bearer ${sToken}` }
    );
    const prodId = prodRes.body.product.id;
    console.log(`✓ Product set up (ID: ${prodId}).\n`);

    // 3. Setup Buyer
    console.log('3. Setting up Buyer...');
    const buyerData = {
      username: `b_lv6_${timestamp}`,
      email: `b_lv6_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['BUYER']
    };
    await request('POST', '/api/auth/register', buyerData);
    const loginB = await request('POST', '/api/auth/login', { username: buyerData.username, password: buyerData.password });
    const bToken = loginB.body.token;
    
    // Top up to support ordering multiple products
    await request('POST', '/api/buyer/topup', { amount: 500000 }, { 'Authorization': `Bearer ${bToken}` });
    await request('PUT', '/api/buyer/address', { address: 'Surabaya Port Lane 6' }, { 'Authorization': `Bearer ${bToken}` });
    
    // Get initial wallet balance
    const meB = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${bToken}` });
    const initialWallet = meB.body.walletBalance;
    console.log(`✓ Buyer balance set up: ${initialWallet}\n`);

    // 4. Generate Voucher & Promo using Admin
    console.log('4. Generating discount codes with Admin...');
    const vRes = await request('POST', '/api/admin/discounts', {
      type: 'voucher',
      code: `VOUCH_${timestamp}`,
      discountValue: 10000,
      expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      remainingUsage: 5
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Voucher response:', vRes.status, vRes.body.message);
    if (vRes.status !== 201) throw new Error('Failed to create voucher');

    const pRes = await request('POST', '/api/admin/discounts', {
      type: 'promo',
      code: `PROMO_${timestamp}`,
      discountValue: 5000,
      expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Promo response:', pRes.status, pRes.body.message);
    if (pRes.status !== 201) throw new Error('Failed to create promo');
    console.log('✓ Voucher & Promo generated.\n');

    // 5. Checkout Order 1: Regular delivery (3-day SLA)
    console.log('5. Buyer placing Order 1 (Regular)...');
    await request('POST', '/api/buyer/cart', { productId: prodId, quantity: 1 }, { 'Authorization': `Bearer ${bToken}` });
    const checkoutRes1 = await request('POST', '/api/buyer/checkout', { deliveryMethod: 'Regular' }, { 'Authorization': `Bearer ${bToken}` });
    const order1 = checkoutRes1.body.order;
    console.log(`Order 1 placed. ID: ${order1.id}, Subtotal: ${order1.subtotal}, Total: ${order1.total}`);
    if (checkoutRes1.status !== 201) throw new Error('Order 1 placement failed');

    // Checkout Order 2: Instant delivery (1-day SLA)
    console.log('Buyer placing Order 2 (Instant)...');
    await request('POST', '/api/buyer/cart', { productId: prodId, quantity: 2 }, { 'Authorization': `Bearer ${bToken}` });
    const checkoutRes2 = await request('POST', '/api/buyer/checkout', { deliveryMethod: 'Instant' }, { 'Authorization': `Bearer ${bToken}` });
    const order2 = checkoutRes2.body.order;
    console.log(`Order 2 placed. ID: ${order2.id}, Subtotal: ${order2.subtotal}, Total: ${order2.total}`);
    if (checkoutRes2.status !== 201) throw new Error('Order 2 placement failed');

    // Checkout Order 3: Next Day delivery (1-day SLA)
    console.log('Buyer placing Order 3 (Next Day)...');
    await request('POST', '/api/buyer/cart', { productId: prodId, quantity: 1 }, { 'Authorization': `Bearer ${bToken}` });
    const checkoutRes3 = await request('POST', '/api/buyer/checkout', { deliveryMethod: 'Next Day' }, { 'Authorization': `Bearer ${bToken}` });
    const order3 = checkoutRes3.body.order;
    console.log(`Order 3 placed. ID: ${order3.id}, Subtotal: ${order3.subtotal}, Total: ${order3.total}`);
    if (checkoutRes3.status !== 201) throw new Error('Order 3 placement failed');

    // Check Product Stock level (initial stock = 10, checked out: 1 + 2 + 1 = 4, so stock should be 6)
    const productCheck = await request('GET', `/api/products/${prodId}`);
    console.log(`Product stock remaining: ${productCheck.body.stock}`);
    if (productCheck.body.stock !== 6) throw new Error(`Incorrect stock: ${productCheck.body.stock}`);
    console.log('✓ Product stock successfully verified as 6.\n');

    // 6. Check Admin Dashboard (before any simulation)
    console.log('6. Checking Admin Dashboard...');
    const dbRes = await request('GET', '/api/admin/dashboard', null, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Dashboard metrics:', dbRes.body);
    if (dbRes.status !== 200) throw new Error('Failed to load admin dashboard');
    if (dbRes.body.totalOrders < 3) throw new Error('Incorrect total orders count');
    console.log('✓ Admin dashboard check complete.\n');

    // Check Income Report for Seller before overdue cancellations
    const incRes1 = await request('GET', '/api/seller/reports/income', null, { 'Authorization': `Bearer ${sToken}` });
    console.log('Seller initial total income:', incRes1.body.totalIncome);
    const expectedInitialIncome = order1.subtotal + order2.subtotal + order3.subtotal;
    if (incRes1.body.totalIncome !== expectedInitialIncome) {
      throw new Error(`Expected income ${expectedInitialIncome}, got ${incRes1.body.totalIncome}`);
    }
    console.log('✓ Seller initial income verified.\n');

    // 7. Simulate Day 1 progression (Should trigger Instant & Next Day overdue)
    console.log('7. Simulating Day 1 progression...');
    const simRes1 = await request('POST', '/api/admin/simulate-next-day', null, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Day 1 simulation results:', simRes1.body);
    if (simRes1.status !== 200) throw new Error('Day 1 simulation failed');
    
    // Check if Order 2 (Instant) and Order 3 (Next Day) are cancelled and Order 1 (Regular) is NOT.
    const ordersB = await request('GET', '/api/buyer/orders', null, { 'Authorization': `Bearer ${bToken}` });
    const o1State = ordersB.body.find(o => o.id === order1.id);
    const o2State = ordersB.body.find(o => o.id === order2.id);
    const o3State = ordersB.body.find(o => o.id === order3.id);
    
    console.log(`Order 1 status (Day 1): ${o1State.status}`);
    console.log(`Order 2 status (Day 1): ${o2State.status}`);
    console.log(`Order 3 status (Day 1): ${o3State.status}`);

    if (o1State.status !== 'Sedang Dikemas') throw new Error('Order 1 status should be Sedang Dikemas on Day 1');
    if (o2State.status !== 'Dikembalikan') throw new Error('Order 2 status should be Dikembalikan on Day 1');
    if (o3State.status !== 'Dikembalikan') throw new Error('Order 3 status should be Dikembalikan on Day 1');

    // Verify wallet balance of buyer has been refunded with Order 2 & 3 total values
    const meB1 = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${bToken}` });
    const expectedWallet1 = initialWallet - order1.total - order2.total - order3.total + order2.total + order3.total;
    console.log(`Buyer wallet balance after Day 1: ${meB1.body.walletBalance} (Expected: ${expectedWallet1})`);
    if (meB1.body.walletBalance !== expectedWallet1) throw new Error('Incorrect buyer wallet refund amount!');

    // Verify stocks of product has been restored: Order 2 (qty 2) & Order 3 (qty 1) restored. Stock: 6 + 2 + 1 = 9
    const prodRes1 = await request('GET', `/api/products/${prodId}`);
    console.log(`Product stock after Day 1: ${prodRes1.body.stock}`);
    if (prodRes1.body.stock !== 9) throw new Error(`Expected product stock to be 9, got ${prodRes1.body.stock}`);

    // Verify Seller Income Report excludes Order 2 & 3 (status 'Dikembalikan')
    const incRes2 = await request('GET', '/api/seller/reports/income', null, { 'Authorization': `Bearer ${sToken}` });
    console.log(`Seller total income after Day 1: ${incRes2.body.totalIncome} (Expected: ${order1.subtotal})`);
    if (incRes2.body.totalIncome !== order1.subtotal) throw new Error('Seller income was not correctly reversed/filtered!');
    console.log('✓ Day 1 simulation assertions passed.\n');

    // 8. Simulate Day 2 progression
    console.log('8. Simulating Day 2 progression...');
    const simRes2 = await request('POST', '/api/admin/simulate-next-day', null, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Day 2 simulation results:', simRes2.body);
    if (simRes2.status !== 200) throw new Error('Day 2 simulation failed');

    // Verify Order 1 (Regular) still not overdue (needs 3 days)
    const ordersB2 = await request('GET', '/api/buyer/orders', null, { 'Authorization': `Bearer ${bToken}` });
    const o1State2 = ordersB2.body.find(o => o.id === order1.id);
    console.log(`Order 1 status (Day 2): ${o1State2.status}`);
    if (o1State2.status !== 'Sedang Dikemas') throw new Error('Order 1 status should be Sedang Dikemas on Day 2');
    console.log('✓ Day 2 simulation assertions passed.\n');

    // 9. Simulate Day 3 progression (Should trigger Regular overdue)
    console.log('9. Simulating Day 3 progression...');
    const simRes3 = await request('POST', '/api/admin/simulate-next-day', null, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Day 3 simulation results:', simRes3.body);
    if (simRes3.status !== 200) throw new Error('Day 3 simulation failed');

    // Verify Order 1 (Regular) is now cancelled/refunded
    const ordersB3 = await request('GET', '/api/buyer/orders', null, { 'Authorization': `Bearer ${bToken}` });
    const o1State3 = ordersB3.body.find(o => o.id === order1.id);
    console.log(`Order 1 status (Day 3): ${o1State3.status}`);
    if (o1State3.status !== 'Dikembalikan') throw new Error('Order 1 status should be Dikembalikan on Day 3');

    // Verify wallet balance of buyer has been fully refunded (initial wallet minus 0 since all orders are now cancelled)
    const meB3 = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${bToken}` });
    console.log(`Buyer wallet balance after Day 3: ${meB3.body.walletBalance} (Expected: ${initialWallet})`);
    if (meB3.body.walletBalance !== initialWallet) throw new Error('Incorrect buyer wallet refund amount after Day 3!');

    // Verify stocks of product restored in full (10)
    const prodRes3 = await request('GET', `/api/products/${prodId}`);
    console.log(`Product stock after Day 3: ${prodRes3.body.stock}`);
    if (prodRes3.body.stock !== 10) throw new Error(`Expected product stock to be 10, got ${prodRes3.body.stock}`);

    // Verify Seller Income Report excludes all (0)
    const incRes3 = await request('GET', '/api/seller/reports/income', null, { 'Authorization': `Bearer ${sToken}` });
    console.log(`Seller total income after Day 3: ${incRes3.body.totalIncome} (Expected: 0)`);
    if (incRes3.body.totalIncome !== 0) throw new Error('Seller income was not correctly reversed/filtered to 0!');
    console.log('✓ Day 3 simulation assertions passed.\n');

    console.log('=== ALL LEVEL 6 ADMIN & OVERDUE TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('❌ Level 6 Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
