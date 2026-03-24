const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const Product = require('./models/Product');

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeParticipants = (sender, receiver) => [sender, receiver].map(String).sort();

const setupSocket = (server) => {
    const io = new Server(server, {
        cors: { origin: process.env.CLIENT_ORIGIN || '*' }
    });

    io.use((socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1] ||
            socket.handshake.query?.token;

        if (!token) return next(new Error('Unauthorized'));

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            socket.userId = decoded.id;
            socket.join(decoded.id);
            return next();
        } catch (err) {
            return next(new Error('Unauthorized'));
        }
    });

    io.on('connection', (socket) => {
        console.log('Socket connected:', socket.userId, socket.id);

        socket.on('sendMessage', async (data) => {
            try {
                const sender = data?.sender;
                const receiver = data?.receiver;
                const productId = data?.productId;
                const message = (data?.message || '').toString().trim();

                if (!sender || !receiver || !productId || !message) {
                    return socket.emit('messageError', { message: 'Missing message fields' });
                }

                if (socket.userId !== sender) {
                    return socket.emit('messageError', { message: 'Sender mismatch' });
                }

                if (![sender, receiver, productId].every(isValidId)) {
                    return socket.emit('messageError', { message: 'Invalid ids provided' });
                }

                if (sender === receiver) {
                    return socket.emit('messageError', { message: 'Cannot message yourself' });
                }

                const product = await Product.findById(productId).select('sellerId');
                if (!product) {
                    return socket.emit('messageError', { message: 'Product not found' });
                }

                const sellerId = product.sellerId?.toString();
                if (![sender, receiver].includes(sellerId)) {
                    return socket.emit('messageError', { message: 'Chat must include the product seller' });
                }

                const newMessage = await Message.create({
                    sender,
                    receiver,
                    productId,
                    message
                });

                const participants = normalizeParticipants(sender, receiver);
                await Conversation.findOneAndUpdate(
                    { productId, participants },
                    {
                        $set: { lastMessage: newMessage.message, updatedAt: new Date() },
                        $setOnInsert: { participants, productId }
                    },
                    { new: true, upsert: true }
                );

                io.to(sender).emit('receiveMessage', newMessage);
                io.to(receiver).emit('receiveMessage', newMessage);
            } catch (err) {
                console.error('Socket sendMessage error:', err);
                socket.emit('messageError', { message: 'Failed to send message' });
            }
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected:', socket.userId, socket.id);
        });
    });

    return io;
};

module.exports = { setupSocket };
