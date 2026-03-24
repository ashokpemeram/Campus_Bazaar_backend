const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        lastMessage: { type: String, default: '' }
    },
    { timestamps: true }
);

conversationSchema.index({ productId: 1, participants: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', conversationSchema);
