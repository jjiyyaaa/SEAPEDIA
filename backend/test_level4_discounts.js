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
  console.log('=== STARTING SEAPEDIA LEVEL 4 DISCOUNTS & PROCESSING TESTS ===\n');

  try {
    const timestamp = Date.now();

    // Setup Admin Account
    console.log('Setting up Admin Account for discount generation...');
    const adminData = {
      username: `admin_lv4_${timestamp}`,
      email: `admin_lv4_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['ADMIN']
    };
    await request('POST', '/api/auth/register', adminData);
    const loginAdmin = await request('POST', '/api/auth/login', { username: adminData.username, password: adminData.password });
    const adminToken = loginAdmin.body.token;

    // 1. Setup Vouchers & Promos
    console.log('1. Setting up Voucher and Promo discount codes...');
    const createV1 = await request('POST', '/api/admin/discounts', {
      type: 'voucher',
      code: `VOUCH15_${timestamp}`,
      discountValue: 15000,
      expiryDate: '2027-01-01T00:00:00.000Z',
      remainingUsage: 1
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Create Voucher VOUCH15 status:', createV1.status, createV1.body);
    if (createV1.status !== 201) throw new Error('Voucher creation failed');

    const createP1 = await request('POST', '/api/admin/discounts', {
      type: 'promo',
      code: `PROMO20_${timestamp}`,
      discountValue: 20000,
      expiryDate: '2027-01-01T00:00:00.000Z'
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Create Promo PROMO20 status:', createP1.status, createP1.body);
    if (createP1.status !== 201) throw new Error('Promo creation failed');

    const createExp = await request('POST', '/api/admin/discounts', {
      type: 'promo',
      code: `EXPIRED_${timestamp}`,
      discountValue: 10000,
      expiryDate: '2020-01-01T00:00:00.000Z'
    }, { 'Authorization': `Bearer ${adminToken}` });
    console.log('Create Expired Promo status:', createExp.status, createExp.body);
    if (createExp.status !== 201) throw new Error('Expired Promo creation failed');
    console.log('✓ Discount setup complete.\n');

    // 2. Setup Seller & Product
    console.log('2. Setting up Seller Store & Product...');
    const sellerData = {
      username: `s_lv4_${timestamp}`,
      email: `s_lv4_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    await request('POST', '/api/auth/register', sellerData);
    const loginS = await request('POST', '/api/auth/login', { username: sellerData.username, password: sellerData.password });
    const sToken = loginS.body.token;
    await request('POST', '/api/seller/store', { name: `Lv4 Store ${timestamp}` }, { 'Authorization': `Bearer ${sToken}` });
    const prodRes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Lobster Premium', description: 'Fresh premium ocean lobster', price: 100000, stock: 10 },
      { 'Authorization': `Bearer ${sToken}` }
    );
    const prodId = prodRes.body.product.id;
    console.log(`✓ Product set up (ID: ${prodId}).\n`);

    // 3. Setup Buyer
    console.log('3. Setting up Buyer...');
    const buyerData = {
      username: `b_lv4_${timestamp}`,
      email: `b_lv4_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['BUYER']
    };
    await request('POST', '/api/auth/register', buyerData);
    const loginB = await request('POST', '/api/auth/login', { username: buyerData.username, password: buyerData.password });
    const bToken = loginB.body.token;
    
    // Top up wallet
    await request('POST', '/api/buyer/topup', { amount: 500000 }, { 'Authorization': `Bearer ${bToken}` });
    // Configure address
    await request('PUT', '/api/buyer/address', { address: 'Tanjung Perak Port, Surabaya' }, { 'Authorization': `Bearer ${bToken}` });
    console.log('✓ Buyer registered, wallet topped up, address configured.\n');

    // 4. Validate Discount code endpoint
    console.log('4. Testing Discount validation endpoint...');
    const valVouch = await request('GET', `/api/buyer/discount/validate?code=VOUCH15_${timestamp}`, null, { 'Authorization': `Bearer ${bToken}` });
    console.log('Validation of active voucher:', valVouch.body);
    if (valVouch.status !== 200 || !valVouch.body.isValid) throw new Error('Active voucher validation failed');

    const valExp = await request('GET', `/api/buyer/discount/validate?code=EXPIRED_${timestamp}`, null, { 'Authorization': `Bearer ${bToken}` });
    console.log('Validation of expired promo (Expected false):', valExp.status, valExp.body);
    if (valExp.status !== 400 || valExp.body.isValid === true) throw new Error('Expired promo should have been rejected');

    const valFake = await request('GET', `/api/buyer/discount/validate?code=FAKE123`, null, { 'Authorization': `Bearer ${bToken}` });
    console.log('Validation of non-existent code (Expected 404):', valFake.status);
    if (valFake.status !== 404) throw new Error('Fake code should return 404');
    console.log('✓ Validation checks passed.\n');

    // 5. Add products to cart
    console.log('5. Adding items to Buyer cart...');
    await request('POST', '/api/buyer/cart', { productId: prodId, quantity: 2 }, { 'Authorization': `Bearer ${bToken}` }); // Subtotal = 200.000
    console.log('✓ Added 2 items (Subtotal: 200000) to cart.\n');

    // 6. Test Checkout with Expired code
    console.log('6. Testing checkout with expired code (Expected block)...');
    const chkExp = await request('POST', '/api/buyer/checkout', {
      deliveryMethod: 'Regular',
      discountCode: `EXPIRED_${timestamp}`
    }, { 'Authorization': `Bearer ${bToken}` });
    console.log('Expired checkout response:', chkExp.status, chkExp.body);
    if (chkExp.status !== 400) throw new Error('Checkout with expired code should be blocked');
    console.log('✓ Expired coupon checkout blocked.\n');

    // 7. Test Checkout with Valid Voucher (VOUCH15)
    console.log('7. Testing checkout with valid Voucher VOUCH15...');
    // Initial Subtotal: 200.000
    // Discount Applied: 15.000
    // Taxable Subtotal: 185.000
    // Tax (12%): 22.200
    // Delivery (Regular): 10.000
    // Expected Total: 185000 + 22200 + 10000 = 217.200
    const chkVouch = await request('POST', '/api/buyer/checkout', {
      deliveryMethod: 'Regular',
      discountCode: `VOUCH15_${timestamp}`
    }, { 'Authorization': `Bearer ${bToken}` });

    console.log('Voucher checkout response status:', chkVouch.status);
    console.log('Grand Total calculated:', chkVouch.body.order.total);
    console.log('Discount Applied stored:', chkVouch.body.order.discountApplied);
    console.log('Discount Code stored:', chkVouch.body.order.discountCode);

    if (chkVouch.status !== 201) throw new Error('Checkout with valid voucher failed');
    if (chkVouch.body.order.discountApplied !== 15000) throw new Error('Stored discountApplied value is incorrect');
    if (chkVouch.body.order.discountCode !== `VOUCH15_${timestamp}`) throw new Error('Stored discountCode is incorrect');
    if (chkVouch.body.order.total !== 217200) throw new Error('Calculated total is incorrect');
    const firstOrderId = chkVouch.body.order.id;
    console.log('✓ Valid voucher checkout complete.\n');

    // 8. Verify Voucher remainingUsage has dropped to 0, and subsequent checkout with same voucher fails
    console.log('8. Verifying voucher usage limits...');
    const valVouchUsage = await request('GET', `/api/buyer/discount/validate?code=VOUCH15_${timestamp}`, null, { 'Authorization': `Bearer ${bToken}` });
    console.log('Validation of used voucher (Expected false):', valVouchUsage.status, valVouchUsage.body);
    if (valVouchUsage.status !== 400 || valVouchUsage.body.isValid === true) throw new Error('Used voucher should have been rejected');

    // Add another item
    await request('POST', '/api/buyer/cart', { productId: prodId, quantity: 1 }, { 'Authorization': `Bearer ${bToken}` }); // Subtotal = 100.000
    const chkReuse = await request('POST', '/api/buyer/checkout', {
      deliveryMethod: 'Regular',
      discountCode: `VOUCH15_${timestamp}`
    }, { 'Authorization': `Bearer ${bToken}` });
    console.log('Checkout attempt using exhausted voucher status:', chkReuse.status);
    if (chkReuse.status !== 400) throw new Error('Exhausted voucher checkout should be blocked');
    console.log('✓ Voucher usage limits validated.\n');

    // 9. Checkout with Promo code (PROMO20)
    console.log('9. Checking out second order with Promo PROMO20...');
    // Cart Subtotal = 100.000
    // Discount Applied = 20.000
    // Taxable Subtotal = 80.000
    // Tax (12%): 9.600
    // Delivery (Regular): 10.000
    // Expected Total: 80000 + 9600 + 10000 = 99.600
    const chkPromo = await request('POST', '/api/buyer/checkout', {
      deliveryMethod: 'Regular',
      discountCode: `PROMO20_${timestamp}`
    }, { 'Authorization': `Bearer ${bToken}` });

    console.log('Promo checkout response status:', chkPromo.status);
    console.log('Grand Total calculated:', chkPromo.body.order.total);
    console.log('Discount Applied stored:', chkPromo.body.order.discountApplied);

    if (chkPromo.status !== 201) throw new Error('Checkout with valid promo failed');
    if (chkPromo.body.order.discountApplied !== 20000) throw new Error('Promo discountValue mismatch');
    if (chkPromo.body.order.total !== 99600) throw new Error('Grand total check failed');
    console.log('✓ Promo checkout complete.\n');

    // 10. Test Financial reports
    console.log('10. Verifying Financial reports (Spending & Income)...');
    const spendingRes = await request('GET', '/api/buyer/reports/spending', null, { 'Authorization': `Bearer ${bToken}` });
    console.log('Buyer Total Spending report:', spendingRes.body);
    // Expected Spending: 217.200 + 99.600 = 316.800
    if (spendingRes.status !== 200 || spendingRes.body.totalSpending !== 316800) {
      throw new Error('Buyer spending calculation is incorrect!');
    }

    const incomeRes = await request('GET', '/api/seller/reports/income', null, { 'Authorization': `Bearer ${sToken}` });
    console.log('Seller Total Income report:', incomeRes.body);
    // Expected Income (Subtotals sum): 200.000 + 100.000 = 300.000
    if (incomeRes.status !== 200 || incomeRes.body.totalIncome !== 300000) {
      throw new Error('Seller income calculation is incorrect!');
    }
    console.log('✓ Spending and income reports verified.\n');

    // 11. Test Order Processing by Seller
    console.log('11. Testing Seller Order Processing...');
    // Process first order from 'Sedang Dikemas' to 'Menunggu Pengirim'
    const procRes = await request('POST', `/api/seller/orders/${firstOrderId}/process`, null, { 'Authorization': `Bearer ${sToken}` });
    console.log('Process order response:', procRes.status, procRes.body);
    if (procRes.status !== 200) throw new Error('Seller processing order failed');
    if (procRes.body.order.status !== 'Menunggu Pengirim') throw new Error('Order status not updated properly');
    
    // Check timeline logs
    const latestHistory = procRes.body.order.statusHistory;
    console.log('Order status history count:', latestHistory.length);
    console.log('Latest history status added:', latestHistory[latestHistory.length - 1].status);
    if (latestHistory.length < 2 || latestHistory[latestHistory.length - 1].status !== 'Menunggu Pengirim') {
      throw new Error('OrderStatusHistory not updated with transition log');
    }

    // Try processing again (must fail as status is already updated)
    const procAgain = await request('POST', `/api/seller/orders/${firstOrderId}/process`, null, { 'Authorization': `Bearer ${sToken}` });
    console.log('Process same order again (Expected block):', procAgain.status, procAgain.body.message);
    if (procAgain.status !== 400) throw new Error('Processing order second time should have been blocked');
    console.log('✓ Order processing status transitions validated.\n');

    console.log('=== ALL LEVEL 4 DISCOUNTS & PROCESSING TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('❌ Level 4 Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
