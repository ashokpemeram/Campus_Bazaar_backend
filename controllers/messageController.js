const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Product = require('../models/Product');

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const getMessages = async (req, res) => {
    try {
        const { productId, userId } = req.params;
        const requesterId = req.user.id;

        if (!isValidId(productId) || !isValidId(userId)) {
            return res.status(400).json({ message: 'Invalid product or user id' });
        }

        if (requesterId === userId) {
            return res.status(400).json({ message: 'Chat requires another user' });
        }

        const product = await Product.findById(productId).select('sellerId');
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const sellerId = product.sellerId?.toString();
        if (![requesterId, userId].includes(sellerId)) {
            return res.status(403).json({ message: 'Chat must include the product seller' });
        }

        const messages = await Message.find({
            productId,
            $or: [
                { sender: requesterId, receiver: userId },
                { sender: userId, receiver: requesterId }
            ]
        }).sort({ createdAt: 1 });

        return res.json(messages);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

const getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user.id })
            .sort({ updatedAt: -1 })
            .populate('participants', 'name email')
            .populate('productId', 'title images price sellerId');

        return res.json(conversations);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getMessages, getConversations };
