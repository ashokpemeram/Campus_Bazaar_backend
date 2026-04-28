const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
    {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        intent: { type: String, default: null },
        products: [
            {
                productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
                title: String,
                price: Number
            }
        ],
        createdAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const chatConversationSchema = new mongoose.Schema(
    {
        conversationId: { type: String, required: true, unique: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        messages: { type: [chatMessageSchema], default: [] }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ChatConversation', chatConversationSchema);
