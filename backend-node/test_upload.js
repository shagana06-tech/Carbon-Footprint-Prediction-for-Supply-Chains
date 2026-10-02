const axios = require('axios');
async function test() {
  try {
    const ts = Date.now();
    const email = `test${ts}@example.com`;
    const res = await axios.post('http://localhost:5000/api/auth/register', {
      companyName: 'Test Corp',
      email: email,
      password: 'password123',
      industry: 'Tech',
      country: 'USA'
    });
    const token = res.data.token;
    console.log("Registered and logged in. Token:", token.substring(0, 10));
    
    const entries = [];
    for(let i=0; i<10000; i++) {
        entries.push({
            period: '2026-08',
            activityType: 'electricity',
            quantity: 100,
            unit: 'kWh',
            region: 'India'
        });
    }
    const upload = await axios.post('http://localhost:5000/api/activity-entries/bulk', 
      { entries }, 
      { headers: { Authorization: `Bearer ${token}` }, maxBodyLength: Infinity, maxContentLength: Infinity }
    );
    console.log("Success:", upload.data);
  } catch(e) {
    console.log("Error:", e.response ? e.response.data : e.message);
  }
}
test();
