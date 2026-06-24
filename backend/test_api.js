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
  console.log('=== STARTING SEAPEDIA BACKEND INTEGRATION TESTS ===\n');

  try {
    // 1. Health Check
    console.log('1. Testing Health Check...');
    const health = await request('GET', '/');
    console.log(`Status: ${health.status}, Response:`, health.body);
    if (health.status !== 200) throw new Error('Health check failed');
    console.log('✓ Health check passed.\n');

    // 2. Submit Review
    console.log('2. Testing Public Review Submission...');
    const reviewData = {
      reviewerName: 'Agus Nelayan',
      rating: 5,
      comment: 'Sangat membantu untuk mendistribusikan ikan hasil tangkapan!'
    };
    const reviewRes = await request('POST', '/api/reviews', reviewData);
    console.log(`Status: ${reviewRes.status}, Response:`, reviewRes.body);
    if (reviewRes.status !== 201) throw new Error('Review submission failed');
    console.log('✓ Public review submission passed.\n');

    // 3. Get Reviews
    console.log('3. Testing Get Reviews...');
    const getReviewsRes = await request('GET', '/api/reviews');
    console.log(`Status: ${getReviewsRes.status}, Reviews Count: ${getReviewsRes.body.length}`);
    console.log('Sample review:', getReviewsRes.body[0]);
    if (getReviewsRes.status !== 200 || getReviewsRes.body.length === 0) throw new Error('Fetching reviews failed');
    console.log('✓ Get reviews passed.\n');

    // 4. Register Multi-role User
    console.log('4. Testing Register User (Buyer + Seller)...');
    const timestamp = Date.now();
    const registerData = {
      username: `ghazi_nelayan_${timestamp}`,
      email: `ghazi_${timestamp}@seapedia.com`,
      password: 'password123',
      roles: ['BUYER', 'SELLER']
    };
    const registerRes = await request('POST', '/api/auth/register', registerData);
    console.log(`Status: ${registerRes.status}, Response:`, registerRes.body);
    if (registerRes.status !== 201) throw new Error('User registration failed');
    console.log('✓ User registration passed.\n');

    // 5. Login
    console.log('5. Testing Login (Should require role selection)...');
    const loginData = {
      username: registerData.username,
      password: registerData.password
    };
    const loginRes = await request('POST', '/api/auth/login', loginData);
    console.log(`Status: ${loginRes.status}, Response:`, loginRes.body);
    if (loginRes.status !== 200 || !loginRes.body.requireRoleSelection) {
      throw new Error('Login failed or did not request role selection');
    }
    const tempToken = loginRes.body.token;
    console.log('✓ Login request role selection validation passed.\n');

    // 6. Select Active Role (SELLER)
    console.log('6. Testing Active Role Selection (SELLER)...');
    const selectRoleRes = await request(
      'POST', 
      '/api/auth/select-role', 
      { role: 'SELLER' }, 
      { 'Authorization': `Bearer ${tempToken}` }
    );
    console.log(`Status: ${selectRoleRes.status}, Response:`, selectRoleRes.body);
    if (selectRoleRes.status !== 200 || selectRoleRes.body.activeRole !== 'SELLER') {
      throw new Error('Active role selection failed');
    }
    let finalToken = selectRoleRes.body.token;
    console.log('✓ Active role selection passed.\n');

    // 7. Get Profile (Expect activeRole = SELLER)
    console.log('7. Testing Get Profile (As SELLER)...');
    const profileRes = await request(
      'GET', 
      '/api/auth/me', 
      null, 
      { 'Authorization': `Bearer ${finalToken}` }
    );
    console.log(`Status: ${profileRes.status}, Response:`, profileRes.body);
    if (profileRes.status !== 200 || profileRes.body.activeRole !== 'SELLER') {
      throw new Error('Fetching profile failed or active role mismatch');
    }
    console.log('✓ Get profile passed.\n');

    // 8. Switch Active Role (To BUYER)
    console.log('8. Testing Switch Active Role (To BUYER)...');
    const switchRoleRes = await request(
      'POST', 
      '/api/auth/switch-role', 
      { role: 'BUYER' }, 
      { 'Authorization': `Bearer ${finalToken}` }
    );
    console.log(`Status: ${switchRoleRes.status}, Response:`, switchRoleRes.body);
    if (switchRoleRes.status !== 200 || switchRoleRes.body.activeRole !== 'BUYER') {
      throw new Error('Switching active role failed');
    }
    finalToken = switchRoleRes.body.token; // Update final token
    console.log('✓ Switch active role passed.\n');

    // 9. Get Profile Again (Expect activeRole = BUYER)
    console.log('9. Testing Get Profile Again (As BUYER)...');
    const profileRes2 = await request(
      'GET', 
      '/api/auth/me', 
      null, 
      { 'Authorization': `Bearer ${finalToken}` }
    );
    console.log(`Status: ${profileRes2.status}, Response:`, profileRes2.body);
    if (profileRes2.status !== 200 || profileRes2.body.activeRole !== 'BUYER') {
      throw new Error('Fetching profile after switch failed or active role mismatch');
    }
    console.log('✓ Get profile verification after switch passed.\n');

    console.log('=== ALL BACKEND INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTests();
