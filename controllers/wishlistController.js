const Wishlist = require('../models/Wishlist');

const addToWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.id;
        
        let wishlist = await Wishlist.findOne({ userId });
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [productId] });
        } else {
            if (wishlist.products.includes(productId)) {
                return res.status(400).json({ message: 'Already in wishlist' });
            }
            wishlist.products.push(productId);
        }
        
        await wishlist.save();
        res.status(201).json(wishlist);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getWishlist = async (req, res) => {
    try {
        const userId = req.user.id;
        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products',
            model: 'Product'
        });
        
        if (!wishlist) return res.json([]);
        
        // Filter out any products that failed to populate (e.g. deleted products)
        const validProducts = wishlist.products.filter(p => p !== null && typeof p === 'object');
        res.json(validProducts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            wishlist.products = wishlist.products.filter(pId => pId.toString() !== id);
            await wishlist.save();
        }
        res.json({ message: 'Removed from wishlist' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addToWishlist, getWishlist, removeFromWishlist };
