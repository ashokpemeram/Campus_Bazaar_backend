const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    shippingAddress: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        college: { type: String, required: true }
    },
    paymentMethod: { type: String, enum: ['COD'], default: 'COD' },
    paymentStatus: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected', 'delivered', 'accepted'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
