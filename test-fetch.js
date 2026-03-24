const testLogin = async () => {
    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@campus.com',
                password: 'admin123'
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log('Login Success:', data);
        } else {
            console.log('Login Failed:', data);
        }
    } catch (err) {
        console.error('Network Error:', err.message);
    }
};

testLogin();
