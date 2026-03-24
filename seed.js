require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/campus-bazaar';

const seedData = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Product.deleteMany({});

        // Create Admin
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@iitb.ac.in',
            password: 'admin123',
            college: 'IIT Bombay',
            collegeName: 'IIT Bombay',
            collegeDomain: 'iitb.ac.in',
            role: 'admin',
            isVerified: true
        });
        console.log('Admin created: admin@iitb.ac.in / admin123');

        // Create Seller
        const user = await User.create({
            name: 'John Doe',
            email: 'john@vit.edu',
            password: 'user123',
            college: 'VIT University',
            collegeName: 'VIT University',
            collegeDomain: 'vit.edu',
            role: 'user',
            isVerified: true
        });
        console.log('User created: john@vit.edu / user123');

        // Create Sample Product
        await Product.create({
            title: 'Gaming Laptop',
            description: 'Powerful gaming laptop, 16GB RAM, RTX 3060.',
            price: 800,
            category: 'Electronics',
            condition: 'Gently Used',
            sellerId: user._id,
            status: 'approved'
        });
        
        await Product.create({
            title: 'Calculus Textbook',
            description: 'Stewart Calculus 8th Edition. Good condition.',
            price: 50,
            category: 'Books',
            condition: 'New',
            sellerId: user._id,
            status: 'pending'
        });

        console.log('Seed data created successfully');
        process.exit();
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
};

seedData();
