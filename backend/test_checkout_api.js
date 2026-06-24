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
  console.log('=== STARTING SEAPEDIA LEVEL 3 CHECKOUT & CART TESTS ===\n');

  try {
    const timestamp = Date.now();

    // 1. Setup Seller 1 (Store A) & Product A
    console.log('1. Setting up Seller 1 & Product A...');
    const seller1Data = {
      username: `s1_${timestamp}`,
      email: `s1_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    await request('POST', '/api/auth/register', seller1Data);
    const loginS1 = await request('POST', '/api/auth/login', { username: seller1Data.username, password: seller1Data.password });
    const s1Token = loginS1.body.token;
    await request('POST', '/api/seller/store', { name: `Store A ${timestamp}` }, { 'Authorization': `Bearer ${s1Token}` });
    const prodARes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Lobster A', description: 'Fresh Lobster', price: 100000, stock: 10 },
      { 'Authorization': `Bearer ${s1Token}` }
    );
    const prodAId = prodARes.body.product.id;
    console.log(`✓ Seller 1 store & Product A (ID: ${prodAId}) setup complete.\n`);

    // 2. Setup Seller 2 (Store B) & Product B
    console.log('2. Setting up Seller 2 & Product B...');
    const seller2Data = {
      username: `s2_${timestamp}`,
      email: `s2_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    await request('POST', '/api/auth/register', seller2Data);
    const loginS2 = await request('POST', '/api/auth/login', { username: seller2Data.username, password: seller2Data.password });
    const s2Token = loginS2.body.token;
    await request('POST', '/api/seller/store', { name: `Store B ${timestamp}` }, { 'Authorization': `Bearer ${s2Token}` });
    const prodBRes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Fish B', description: 'Fresh Fish', price: 50000, stock: 10 },
      { 'Authorization': `Bearer ${s2Token}` }
    );
    const prodBId = prodBRes.body.product.id;
    console.log(`✓ Seller 2 store & Product B (ID: ${prodBId}) setup complete.\n`);

    // 3. Register Buyer & Login
    console.log('3. Setting up Buyer...');
    const buyerData = {
      username: `buyer_${timestamp}`,
      email: `buyer_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['BUYER']
    };
    await request('POST', '/api/auth/register', buyerData);
    const loginB = await request('POST', '/api/auth/login', { username: buyerData.username, password: buyerData.password });
    const buyerToken = loginB.body.token;
    console.log(`✓ Buyer setup complete.\n`);

    // 4. Wallet Top-Up and Address Configuration
    console.log('4. Testing Wallet Top-up & Address updates...');
    const topupRes = await request(
      'POST',
      '/api/buyer/topup',
      { amount: 300000 },
      { 'Authorization': `Bearer ${buyerToken}` }
    );
    console.log('Topup balance response:', topupRes.body);
    if (topupRes.status !== 200 || topupRes.body.walletBalance !== 300000) {
      throw new Error('Wallet Topup failed');
    }

    const addressRes = await request(
      'PUT',
      '/api/buyer/address',
      { address: 'Benoa Port Lane 99, Bali' },
      { 'Authorization': `Bearer ${buyerToken}` }
    );
    console.log('Address update response:', addressRes.body);
    if (addressRes.status !== 200 || addressRes.body.address !== 'Benoa Port Lane 99, Bali') {
      throw new Error('Address update failed');
    }
    console.log('✓ Wallet Topup & Address configuration passed.\n');

    // 5. Add Product A to Cart
    console.log('5. Adding Product A (Store A) to Cart...');
    const cartRes1 = await request(
      'POST',
      '/api/buyer/cart',
      { productId: prodAId, quantity: 2 },
      { 'Authorization': `Bearer ${buyerToken}` }
    );
    console.log('Add Product A:', cartRes1.body);
    if (cartRes1.status !== 201) throw new Error('Adding product A to cart failed');
    console.log('✓ Added Product A successfully.\n');

    // 6. Attempt Single-Store Rule Mismatch (Add Product B from Store B)
    console.log('6. Testing Single-Store Cart Rule Violation...');
    const cartRes2 = await request(
      'POST',
      '/api/buyer/cart',
      { productId: prodBId, quantity: 1 },
      { 'Authorization': `Bearer ${buyerToken}` }
    );
    console.log(`Status: ${cartRes2.status}, Response:`, cartRes2.body);
    if (cartRes2.status !== 400 || !cartRes2.body.requiresClearCart) {
      throw new Error('Server allowed products from multiple stores in cart!');
    }
    console.log('✓ Single-Store Cart Rule validated (400 Bad Request with requiresClearCart).\n');

    // 7. Get Cart Details
    console.log('7. Verifying Cart details and subtotal...');
    const cartDetails = await request('GET', '/api/buyer/cart', null, { 'Authorization': `Bearer ${buyerToken}` });
    console.log(`Status: ${cartDetails.status}, Subtotal: ${cartDetails.body.subtotal}, Items count: ${cartDetails.body.items.length}`);
    if (cartDetails.status !== 200 || cartDetails.body.subtotal !== 200000 || cartDetails.body.items.length !== 1) {
      throw new Error('Cart details verification failed');
    }
    console.log('✓ Cart details check passed.\n');

    // 8. Checkout Cart items to Order
    console.log('8. Testing Order Checkout (Regular Method)...');
    // Financials check:
    // Subtotal = 2 * 100.000 = 200.000
    // Delivery (Regular) = 10.000
    // PPN (12%) = 24.000
    // Total = 234.000
    // Expected remaining Wallet balance = 300.000 - 234.000 = 66.000
    const checkoutRes = await request(
      'POST',
      '/api/buyer/checkout',
      { deliveryMethod: 'Regular' },
      { 'Authorization': `Bearer ${buyerToken}` }
    );
    console.log(`Status: ${checkoutRes.status}, Response Order Total: ${checkoutRes.body.order.total}`);
    if (checkoutRes.status !== 201 || checkoutRes.body.order.total !== 234000 || checkoutRes.body.order.status !== 'Sedang Dikemas') {
      throw new Error('Checkout transaction failed');
    }
    console.log('✓ Checkout successful.\n');

    // 9. Verify wallet balance and stock changes in DB
    console.log('9. Checking database updates (Wallet Balance & Product Stock)...');
    const profileRes = await request('GET', '/api/auth/me', null, { 'Authorization': `Bearer ${buyerToken}` });
    console.log(`Buyer Remaining Balance: ${profileRes.body.walletBalance} (Expected: 66000)`);
    if (profileRes.body.walletBalance !== 66000) {
      throw new Error('Deduction of wallet balance is incorrect!');
    }

    const publicCatalog = await request('GET', '/api/products');
    const updatedProdA = publicCatalog.body.find(p => p.id === prodAId);
    console.log(`Product A Stock: ${updatedProdA.stock} (Expected: 8)`);
    if (updatedProdA.stock !== 8) {
      throw new Error('Deduction of product stock is incorrect!');
    }

    const cartEmptyCheck = await request('GET', '/api/buyer/cart', null, { 'Authorization': `Bearer ${buyerToken}` });
    console.log(`Cart items count: ${cartEmptyCheck.body.items.length} (Expected: 0)`);
    if (cartEmptyCheck.body.items.length !== 0) {
      throw new Error('Cart was not emptied after checkout!');
    }
    console.log('✓ Wallet balance, stock updates, and cleared cart verified.\n');

    // 10. Verify Order History for Buyer
    console.log('10. Verifying Buyer Orders History...');
    const buyerOrders = await request('GET', '/api/buyer/orders', null, { 'Authorization': `Bearer ${buyerToken}` });
    console.log(`Buyer Orders count: ${buyerOrders.body.length}, First Order Status: ${buyerOrders.body[0].status}`);
    if (buyerOrders.body.length !== 1 || buyerOrders.body[0].total !== 234000 || buyerOrders.body[0].statusHistory.length === 0) {
      throw new Error('Buyer order log verification failed');
    }
    console.log('✓ Buyer orders history verified.\n');

    // 11. Verify Inbound Orders for Seller 1
    console.log('11. Verifying Seller 1 Inbound Customer Orders...');
    const sellerOrders = await request('GET', '/api/seller/orders', null, { 'Authorization': `Bearer ${s1Token}` });
    console.log(`Seller Inbound Orders count: ${sellerOrders.body.length}, Subtotal: ${sellerOrders.body[0].subtotal}`);
    if (sellerOrders.body.length !== 1 || sellerOrders.body[0].subtotal !== 200000) {
      throw new Error('Seller inbound order verification failed');
    }
    console.log('✓ Seller inbound orders verified.\n');

    // 12. Checkout Insufficient Balance Block
    console.log('12. Testing Insufficient Wallet Balance checkout block...');
    // Add product B to cart
    await request('POST', '/api/buyer/cart', { productId: prodBId, quantity: 2 }, { 'Authorization': `Bearer ${buyerToken}` });
    // Subtotal = 2 * 50000 = 100000
    // Regular Delivery = 10000
    // Tax = 12000
    // Total = 122000 (Wallet balance is 66000)
    const blockCheckout = await request(
      'POST',
      '/api/buyer/checkout',
      { deliveryMethod: 'Regular' },
      { 'Authorization': `Bearer ${buyerToken}` }
    );
    console.log(`Status: ${blockCheckout.status}, Response:`, blockCheckout.body);
    if (blockCheckout.status !== 400) {
      throw new Error('Checkout with insufficient funds should have been blocked!');
    }
    console.log('✓ Insufficient funds check blocked successfully.\n');

    console.log('=== ALL LEVEL 3 CART & CHECKOUT TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
