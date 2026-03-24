const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

const debug = async () => {
    await mongoose.connect('mongodb://127.0.0.1:27017/campus-bazaar');
    const user = await User.findOne({ email: 'admin@campus.com' });
    if (!user) {
        console.log('User not found');
        process.exit();
    }
    console.log('User found:', user.email);
    console.log('Stored Hash:', user.password);
    
    const isMatch = await bcrypt.compare('admin123', user.password);
    console.log('Comparison Result for admin123:', isMatch);
    
    process.exit();
};

debug();
