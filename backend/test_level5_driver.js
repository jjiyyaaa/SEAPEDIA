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
  console.log('=== STARTING SEAPEDIA LEVEL 5 DRIVER & DELIVERY TESTS ===\n');

  try {
    const timestamp = Date.now();

    // 1. Setup Seller & Product
    console.log('1. Setting up Seller Store & Product...');
    const sellerData = {
      username: `s_lv5_${timestamp}`,
      email: `s_lv5_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    await request('POST', '/api/auth/register', sellerData);
    const loginS = await request('POST', '/api/auth/login', { username: sellerData.username, password: sellerData.password });
    const sToken = loginS.body.token;
    await request('POST', '/api/seller/store', { name: `Lv5 Store ${timestamp}` }, { 'Authorization': `Bearer ${sToken}` });
    const prodRes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Lobster Cargo', description: 'Premium catch', price: 100000, stock: 10 },
      { 'Authorization': `Bearer ${sToken}` }
    );
    const prodId = prodRes.body.product.id;
    console.log(`✓ Product set up (ID: ${prodId}).\n`);

    // 2. Setup Buyer
    console.log('2. Setting up Buyer & placing order...');
    const buyerData = {
      username: `b_lv5_${timestamp}`,
      email: `b_lv5_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['BUYER']
    };
    await request('POST', '/api/auth/register', buyerData);
    const loginB = await request('POST', '/api/auth/login', { username: buyerData.username, password: buyerData.password });
    const bToken = loginB.body.token;
    await request('POST', '/api/buyer/topup', { amount: 200000 }, { 'Authorization': `Bearer ${bToken}` });
    await request('PUT', '/api/buyer/address', { address: 'Surabaya Port Lane 5' }, { 'Authorization': `Bearer ${bToken}` });
    
    // Add to cart
    await request('POST', '/api/buyer/cart', { productId: prodId, quantity: 1 }, { 'Authorization': `Bearer ${bToken}` });
    
    // Checkout
    const checkoutRes = await request('POST', '/api/buyer/checkout', { deliveryMethod: 'Regular' }, { 'Authorization': `Bearer ${bToken}` });
    const orderId = checkoutRes.body.order.id;
    console.log(`✓ Order placed successfully (ID: ${orderId}, Status: ${checkoutRes.body.order.status}).\n`);

    // 3. Register Driver 1 & Driver 2
    console.log('3. Registering Drivers...');
    const d1Data = { username: `d1_${timestamp}`, email: `d1_${timestamp}@seapedia.com`, password: 'password123', roles: ['DRIVER'] };
    await request('POST', '/api/auth/register', d1Data);
    const loginD1 = await request('POST', '/api/auth/login', { username: d1Data.username, password: d1Data.password });
    const d1Token = loginD1.body.token;

    const d2Data = { username: `d2_${timestamp}`, email: `d2_${timestamp}@seapedia.com`, password: 'password123', roles: ['DRIVER'] };
    await request('POST', '/api/auth/register', d2Data);
    const loginD2 = await request('POST', '/api/auth/login', { username: d2Data.username, password: d2Data.password });
    const d2Token = loginD2.body.token;
    console.log('✓ Driver 1 & Driver 2 accounts registered.\n');

    // 4. Verify Available Jobs (Order is currently 'Sedang Dikemas', should NOT be visible)
    console.log('4. Verifying available jobs lists (Expected: empty)...');
    const jobsRes1 = await request('GET', '/api/driver/jobs', null, { 'Authorization': `Bearer ${d1Token}` });
    console.log('Jobs listing status:', jobsRes1.status, 'Available jobs count:', jobsRes1.body.length);
    const foundOrderBefore = jobsRes1.body.find(job => job.id === orderId);
    if (foundOrderBefore) throw new Error('Order was listed in available jobs but status is still Sedang Dikemas!');
    console.log('✓ Order is correctly hidden from driver job list.\n');

    // 5. Seller processes order (status changes to 'Menunggu Pengirim')
    console.log('5. Seller processing order to dispatch queue...');
    const processRes = await request('POST', `/api/seller/orders/${orderId}/process`, null, { 'Authorization': `Bearer ${sToken}` });
    console.log('Process order status:', processRes.status, 'New order status:', processRes.body.order.status);
    if (processRes.status !== 200 || processRes.body.order.status !== 'Menunggu Pengirim') {
      throw new Error('Seller processing failed');
    }
    console.log('✓ Order pushed to Menunggu Pengirim queue.\n');

    // 6. Verify Available Jobs again (Order should be visible)
    console.log('6. Verifying available jobs again (Expected: contains order)...');
    const jobsRes2 = await request('GET', '/api/driver/jobs', null, { 'Authorization': `Bearer ${d1Token}` });
    console.log('Available jobs count:', jobsRes2.body.length);
    const foundOrderAfter = jobsRes2.body.find(job => job.id === orderId);
    if (!foundOrderAfter) throw new Error('Order is missing from available jobs even though status is Menunggu Pengirim!');
    console.log('✓ Order found in driver available jobs queue.\n');

    // 7. Driver 1 takes the job
    console.log('7. Driver 1 accepting the job task...');
    const takeRes1 = await request('POST', `/api/driver/jobs/${orderId}/take`, null, { 'Authorization': `Bearer ${d1Token}` });
    console.log('Driver 1 take response:', takeRes1.status, takeRes1.body.message);
    if (takeRes1.status !== 200) throw new Error('Driver 1 failed to accept job');
    console.log('New order status:', takeRes1.body.order.status, 'Driver ID assigned:', takeRes1.body.order.driverId);
    if (takeRes1.body.order.status !== 'Sedang Dikirim') throw new Error('Order status was not set to Sedang Dikirim');
    console.log('✓ Driver 1 successfully accepted the job.\n');

    // 8. Driver 2 tries to accept same job (Expected: block/conflict)
    console.log('8. Testing concurrent job accepts (Driver 2 accepts same job)...');
    const takeRes2 = await request('POST', `/api/driver/jobs/${orderId}/take`, null, { 'Authorization': `Bearer ${d2Token}` });
    console.log('Driver 2 take response (Expected block):', takeRes2.status, takeRes2.body.message);
    if (takeRes2.status !== 400) throw new Error('Driver 2 should have been blocked from accepting a taken job!');
    console.log('✓ Single-courier conflict guard successfully passed.\n');

    // 9. Driver 1 completes delivery
    console.log('9. Driver 1 completing delivery...');
    const compRes = await request('POST', `/api/driver/jobs/${orderId}/complete`, null, { 'Authorization': `Bearer ${d1Token}` });
    console.log('Complete job response status:', compRes.status, 'Message:', compRes.body.message);
    if (compRes.status !== 200) throw new Error('Driver 1 failed to complete job');
    console.log('Final order status:', compRes.body.order.status);
    if (compRes.body.order.status !== 'Pesanan Selesai') throw new Error('Order status was not set to Pesanan Selesai');
    console.log('✓ Delivery complete confirmed.\n');

    // 10. Verify Driver Dashboard & Earnings
    console.log('10. Verifying Driver dashboard metrics...');
    const dashboardRes = await request('GET', '/api/driver/dashboard', null, { 'Authorization': `Bearer ${d1Token}` });
    console.log('Driver Earnings calculated:', dashboardRes.body.earnings);
    console.log('Driver completed history items:', dashboardRes.body.history.length);
    console.log('Driver active job status:', dashboardRes.body.activeJob);
    if (dashboardRes.status !== 200) throw new Error('Failed to fetch driver dashboard');
    if (dashboardRes.body.earnings !== 10000) throw new Error('Earnings do not match delivery fee!');
    if (dashboardRes.body.history.length !== 1) throw new Error('History list count is incorrect');
    if (dashboardRes.body.activeJob !== null) throw new Error('Active job should be null');
    console.log('✓ Driver dashboard metrics verified successfully.\n');

    console.log('=== ALL LEVEL 5 DRIVER & DELIVERY TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('❌ Level 5 Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
