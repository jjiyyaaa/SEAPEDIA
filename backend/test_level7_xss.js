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
  console.log('=== STARTING SEAPEDIA LEVEL 7 SECURITY & BOUNDARY TESTS ===\n');

  try {
    const timestamp = Date.now();

    // 1. Submit Guest Review with XSS Payload
    console.log('1. Testing Guest Review XSS payload...');
    const xssReview = {
      reviewerName: `<script>alert("xss_user")</script>`,
      rating: 5,
      comment: `Hello <img src="x" onerror="alert('comment_xss')"> World`
    };

    const revRes = await request('POST', '/api/reviews', xssReview);
    console.log('Review response status:', revRes.status);
    console.log('Review response reviewerName:', revRes.body.review.reviewerName);
    console.log('Review response comment:', revRes.body.review.comment);

    if (revRes.status !== 201) throw new Error('Review submission failed');
    if (revRes.body.review.reviewerName.includes('<') || revRes.body.review.reviewerName.includes('>')) {
      throw new Error('XSS reviewerName was not escaped!');
    }
    if (revRes.body.review.comment.includes('<') || revRes.body.review.comment.includes('>')) {
      throw new Error('XSS comment was not escaped!');
    }
    console.log('✓ XSS review escaping verified.\n');

    // 2. Setup Buyer and test Address XSS payload
    console.log('2. Testing Buyer Address XSS payload...');
    const buyerData = {
      username: `b_lv7_${timestamp}`,
      email: `b_lv7_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['BUYER']
    };
    await request('POST', '/api/auth/register', buyerData);
    const loginB = await request('POST', '/api/auth/login', { username: buyerData.username, password: buyerData.password });
    const bToken = loginB.body.token;

    const xssAddress = `Lane <script>destruct()</script> #99`;
    const addrRes = await request('PUT', '/api/buyer/address', { address: xssAddress }, { 'Authorization': `Bearer ${bToken}` });
    console.log('Address update status:', addrRes.status);
    console.log('Returned Address:', addrRes.body.address);
    if (addrRes.status !== 200) throw new Error('Address update failed');
    if (addrRes.body.address.includes('<') || addrRes.body.address.includes('>')) {
      throw new Error('XSS Address was not escaped!');
    }
    console.log('✓ XSS shipping address escaping verified.\n');

    // 3. Setup Seller and test Store Name XSS payload
    console.log('3. Testing Seller Store Name XSS payload...');
    const sellerData = {
      username: `s_lv7_${timestamp}`,
      email: `s_lv7_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['SELLER']
    };
    await request('POST', '/api/auth/register', sellerData);
    const loginS = await request('POST', '/api/auth/login', { username: sellerData.username, password: sellerData.password });
    const sToken = loginS.body.token;

    const xssStoreName = `Store <iframe src="xss"></iframe> _${timestamp}`;
    const storeRes = await request('POST', '/api/seller/store', { name: xssStoreName }, { 'Authorization': `Bearer ${sToken}` });
    console.log('Store response status:', storeRes.status);
    console.log('Store name returned:', storeRes.body.store.name);
    if (storeRes.status !== 201) throw new Error('Store registration failed');
    if (storeRes.body.store.name.includes('<') || storeRes.body.store.name.includes('>')) {
      throw new Error('XSS Store Name was not escaped!');
    }
    console.log('✓ XSS store name escaping verified.\n');

    // 4. Test Product boundary numeric validation (0 or negative values)
    console.log('4. Testing Product boundary numeric validation (Price & Stock)...');
    
    // a. Invalid Price = 0
    const zeroPriceRes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Lobster', description: 'Fresh catch', price: 0, stock: 10 },
      { 'Authorization': `Bearer ${sToken}` }
    );
    console.log('Create product with price 0 status (Expected 400):', zeroPriceRes.status, zeroPriceRes.body.message);
    if (zeroPriceRes.status !== 400) throw new Error('Product creation with price 0 should be blocked');

    // b. Invalid Stock = 0
    const zeroStockRes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Lobster', description: 'Fresh catch', price: 10000, stock: 0 },
      { 'Authorization': `Bearer ${sToken}` }
    );
    console.log('Create product with stock 0 status (Expected 400):', zeroStockRes.status, zeroStockRes.body.message);
    if (zeroStockRes.status !== 400) throw new Error('Product creation with stock 0 should be blocked');

    // c. Invalid Price = -50
    const negPriceRes = await request(
      'POST',
      '/api/seller/products',
      { name: 'Lobster', description: 'Fresh catch', price: -50, stock: 10 },
      { 'Authorization': `Bearer ${sToken}` }
    );
    console.log('Create product with negative price status (Expected 400):', negPriceRes.status, negPriceRes.body.message);
    if (negPriceRes.status !== 400) throw new Error('Product creation with negative price should be blocked');

    // d. Valid creation with XSS name/description
    console.log('Testing Product Name & Description XSS payload...');
    const xssProdName = `Fish <script>xss()</script>`;
    const xssProdDesc = `Premium catch <img src="x" onerror="evil()">`;
    const validProdRes = await request(
      'POST',
      '/api/seller/products',
      { name: xssProdName, description: xssProdDesc, price: 25000, stock: 5 },
      { 'Authorization': `Bearer ${sToken}` }
    );
    console.log('Create product with XSS status:', validProdRes.status);
    console.log('Returned product name:', validProdRes.body.product.name);
    console.log('Returned product description:', validProdRes.body.product.description);
    if (validProdRes.status !== 201) throw new Error('Valid product creation failed');
    if (validProdRes.body.product.name.includes('<') || validProdRes.body.product.name.includes('>')) {
      throw new Error('Product name was not XSS escaped!');
    }
    if (validProdRes.body.product.description.includes('<') || validProdRes.body.product.description.includes('>')) {
      throw new Error('Product description was not XSS escaped!');
    }
    console.log('✓ XSS product details escaping and numeric boundaries verified successfully.\n');

    console.log('=== ALL LEVEL 7 SECURITY & BOUNDARY TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('❌ Level 7 Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
