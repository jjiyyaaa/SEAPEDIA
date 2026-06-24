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
  console.log('=== STARTING SEAPEDIA LEVEL 2 SELLER EXPERIENCE TESTS ===\n');

  try {
    const timestamp = Date.now();
    
    // 1. Register Seller 1
    console.log('1. Registering Seller 1 (ghazi_seller)...');
    const seller1Data = {
      username: `ghazi_seller_${timestamp}`,
      email: `seller_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    const regSeller1 = await request('POST', '/api/auth/register', seller1Data);
    if (regSeller1.status !== 201) throw new Error('Seller 1 registration failed');
    console.log('✓ Seller 1 registered.\n');

    // 2. Login Seller 1 (Expect automatic final token since single role)
    console.log('2. Logging in Seller 1...');
    const loginSeller1 = await request('POST', '/api/auth/login', {
      username: seller1Data.username,
      password: seller1Data.password
    });
    if (loginSeller1.status !== 200 || loginSeller1.body.requireRoleSelection) {
      throw new Error('Seller 1 login failed or requested role selection');
    }
    const seller1Token = loginSeller1.body.token;
    console.log('✓ Seller 1 logged in. Active Role:', loginSeller1.body.activeRole);
    console.log('✓ Token received.\n');

    // 3. Create Store Profile
    console.log('3. Registering Store for Seller 1 (Banda Sea Fresh)...');
    const storeName = `Banda Sea Fresh ${timestamp}`;
    const storeRes = await request(
      'POST',
      '/api/seller/store',
      { name: storeName },
      { 'Authorization': `Bearer ${seller1Token}` }
    );
    console.log(`Status: ${storeRes.status}, Response:`, storeRes.body);
    if (storeRes.status !== 201) throw new Error('Store registration failed');
    console.log('✓ Store registered.\n');

    // 4. Try to register store with DUPLICATE NAME using another seller
    console.log('4. Registering Seller 2 (ghazi_hacker)...');
    const seller2Data = {
      username: `ghazi_hacker_${timestamp}`,
      email: `hacker_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    const regSeller2 = await request('POST', '/api/auth/register', seller2Data);
    if (regSeller2.status !== 201) throw new Error('Seller 2 registration failed');

    const loginSeller2 = await request('POST', '/api/auth/login', {
      username: seller2Data.username,
      password: seller2Data.password
    });
    const seller2Token = loginSeller2.body.token;

    console.log('Attempting to create store with duplicate name...');
    const duplicateStoreRes = await request(
      'POST',
      '/api/seller/store',
      { name: storeName },
      { 'Authorization': `Bearer ${seller2Token}` }
    );
    console.log(`Status: ${duplicateStoreRes.status}, Response:`, duplicateStoreRes.body);
    if (duplicateStoreRes.status !== 400) {
      throw new Error('Server allowed duplicate store name!');
    }
    console.log('✓ Duplicate store name guard passed.\n');

    // Create a valid store for Seller 2 so we can test product access boundaries
    const hackerStoreName = `Hacker Fishing ${timestamp}`;
    const hackerStoreRes = await request(
      'POST',
      '/api/seller/store',
      { name: hackerStoreName },
      { 'Authorization': `Bearer ${seller2Token}` }
    );
    if (hackerStoreRes.status !== 201) throw new Error('Hacker store creation failed');
    console.log('✓ Seller 2 store registered.\n');

    // 5. Seller 1 fetches Dashboard (Check hasStore and empty products)
    console.log('5. Fetching Seller 1 Dashboard...');
    const dashboardRes = await request(
      'GET',
      '/api/seller/dashboard',
      null,
      { 'Authorization': `Bearer ${seller1Token}` }
    );
    console.log(`Status: ${dashboardRes.status}, Store name: ${dashboardRes.body.store.name}, Products count: ${dashboardRes.body.store.products.length}`);
    if (dashboardRes.status !== 200 || !dashboardRes.body.hasStore || dashboardRes.body.store.products.length !== 0) {
      throw new Error('Invalid dashboard details');
    }
    console.log('✓ Fetch dashboard passed.\n');

    // 6. Seller 1 creates a product
    console.log('6. Adding a product as Seller 1 (Yellowfin Tuna)...');
    const productData = {
      name: 'Premium Yellowfin Tuna',
      description: 'Sashimi grade yellowfin tuna caught in Banda Sea.',
      price: 135000,
      stock: 25
    };
    const prodRes = await request(
      'POST',
      '/api/seller/products',
      productData,
      { 'Authorization': `Bearer ${seller1Token}` }
    );
    console.log(`Status: ${prodRes.status}, Response:`, prodRes.body);
    if (prodRes.status !== 201) throw new Error('Product creation failed');
    const productId = prodRes.body.product.id;
    console.log('✓ Product created.\n');

    // 7. Verify Public Catalog contains the product
    console.log('7. Verifying public catalog GET /api/products...');
    const publicCatalog = await request('GET', '/api/products');
    console.log(`Status: ${publicCatalog.status}, Total products: ${publicCatalog.body.length}`);
    const foundProduct = publicCatalog.body.find(p => p.id === productId);
    if (!foundProduct || foundProduct.name !== productData.name || foundProduct.store.name !== storeName) {
      throw new Error('Product not found in catalog or store relationship incorrect');
    }
    console.log(`✓ Product found in catalog. Sold by: ${foundProduct.store.name}\n`);

    // 8. Verify Public Product Details
    console.log(`8. Verifying public details GET /api/products/${productId}...`);
    const prodDetail = await request('GET', `/api/products/${productId}`);
    console.log(`Status: ${prodDetail.status}, Response product name: ${prodDetail.body.name}, Seller store: ${prodDetail.body.store.name}`);
    if (prodDetail.status !== 200 || prodDetail.body.name !== productData.name || prodDetail.body.store.name !== storeName) {
      throw new Error('Fetching product details failed');
    }
    console.log('✓ Product detail check passed.\n');

    // 9. Unauthorized update attempt by Seller 2 on Seller 1's product
    console.log(`9. Testing cross-owner update block (Seller 2 trying to update Seller 1's product)...`);
    const updateAttemptRes = await request(
      'PUT',
      `/api/seller/products/${productId}`,
      {
        name: 'Hacked Tuna',
        description: 'I hacked your tuna.',
        price: 500,
        stock: 1
      },
      { 'Authorization': `Bearer ${seller2Token}` }
    );
    console.log(`Status: ${updateAttemptRes.status}, Response:`, updateAttemptRes.body);
    if (updateAttemptRes.status !== 403) {
      throw new Error('Cross-store update protection failed! Server allowed cross-edit.');
    }
    console.log('✓ Cross-owner update block validated (403 Forbidden).\n');

    // 10. Unauthorized delete attempt by Seller 2 on Seller 1's product
    console.log(`10. Testing cross-owner delete block (Seller 2 trying to delete Seller 1's product)...`);
    const deleteAttemptRes = await request(
      'DELETE',
      `/api/seller/products/${productId}`,
      null,
      { 'Authorization': `Bearer ${seller2Token}` }
    );
    console.log(`Status: ${deleteAttemptRes.status}, Response:`, deleteAttemptRes.body);
    if (deleteAttemptRes.status !== 403) {
      throw new Error('Cross-store delete protection failed! Server allowed cross-delete.');
    }
    console.log('✓ Cross-owner delete block validated (403 Forbidden).\n');

    // 11. Authorized update by Seller 1
    console.log(`11. Updating product as original owner (Seller 1)...`);
    const updatedData = {
      name: 'Premium Yellowfin Tuna (Updated)',
      description: 'Sashimi grade yellowfin tuna caught in Banda Sea (Iced Fresh).',
      price: 140000,
      stock: 20
    };
    const updateRes = await request(
      'PUT',
      `/api/seller/products/${productId}`,
      updatedData,
      { 'Authorization': `Bearer ${seller1Token}` }
    );
    console.log(`Status: ${updateRes.status}, Response:`, updateRes.body);
    if (updateRes.status !== 200 || updateRes.body.product.price !== updatedData.price || updateRes.body.product.stock !== updatedData.stock) {
      throw new Error('Authorized product update failed');
    }
    console.log('✓ Authorized update passed.\n');

    // 12. Authorized delete by Seller 1
    console.log(`12. Deleting product as original owner (Seller 1)...`);
    const deleteRes = await request(
      'DELETE',
      `/api/seller/products/${productId}`,
      null,
      { 'Authorization': `Bearer ${seller1Token}` }
    );
    console.log(`Status: ${deleteRes.status}, Response:`, deleteRes.body);
    if (deleteRes.status !== 200) throw new Error('Authorized product deletion failed');
    console.log('✓ Authorized product deletion passed.\n');

    // 13. Verify product is removed from Seller 1 dashboard
    console.log('13. Verifying product count after delete...');
    const dashboardAfterRes = await request(
      'GET',
      '/api/seller/dashboard',
      null,
      { 'Authorization': `Bearer ${seller1Token}` }
    );
    console.log(`Products Count: ${dashboardAfterRes.body.store.products.length}`);
    if (dashboardAfterRes.body.store.products.length !== 0) {
      throw new Error('Product still exists in inventory after deletion!');
    }
    console.log('✓ Product removal verified.\n');

    console.log('=== ALL LEVEL 2 SELLER EXPERIENCE TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
