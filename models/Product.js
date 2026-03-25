const mongoose = require('mongoose');
const { CATEGORIES } = require('../config/categories');

const productSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, enum: CATEGORIES, required: true },
    condition: { type: String, required: true },
    images: [{ type: String }],
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'reserved', 'sold'], default: 'pending' },
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    views: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
