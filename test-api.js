const axios = require('axios');

const testLogin = async () => {
    try {
        const res = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'admin@campus.com',
            password: 'admin123'
        });
        console.log('Login Success:', res.data);
    } catch (err) {
        console.error('Login Failed:', err.response ? err.response.data : err.message);
    }
};

testLogin();
