const Product = require('../models/Product');
const User = require('../models/User');

const BASE_PRODUCT_FILTER = { status: 'approved', isAvailable: true };

const clampRecommendLimit = (value, fallback = 8) => {
    const parsed = Number(value);
    const limit = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(10, Math.max(5, limit));
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractKeywords = (text) => {
    const tokens = (text || '').match(/[a-z0-9]+/gi) || [];
    const filtered = tokens.map((t) => t.toLowerCase()).filter((t) => t.length > 2);
    return [...new Set(filtered)];
};

const buildRegexFromKeywords = (keywords) => {
    if (!keywords || keywords.length === 0) return null;
    const pattern = keywords.map(escapeRegex).join('|');
    if (!pattern) return null;
    return new RegExp(pattern, 'i');
};

const getAllProducts = async (req, res) => {
    try {
        const { search, category, minPrice, maxPrice, condition, sortBy, page = 1, limit = 10, sameCollege } = req.query;
        
        let query = { ...BASE_PRODUCT_FILTER };
        const filterSameCollege = sameCollege === 'true';

        if (filterSameCollege) {
            if (!req.user) {
                return res.status(401).json({ message: 'Login required to filter by college' });
            }
            if (!req.user.college) {
                return res.status(400).json({ message: 'College not set for your profile' });
            }
            const collegeUsers = await User.find({ college: req.user.college }).select('_id');
            query.sellerId = { $in: collegeUsers.map(u => u._id) };
        }
        
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }
        
        if (category) {
            query.category = category;
        }
        
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }
        
        if (condition) {
            query.condition = condition;
        }
        
        let sort = {};
        if (sortBy === 'priceLow') sort.price = 1;
        else if (sortBy === 'priceHigh') sort.price = -1;
        else sort.createdAt = -1;

        const activityKeywords = [];
        if (search) activityKeywords.push(...extractKeywords(search));
        if (category) activityKeywords.push(category);

        if (req.user && activityKeywords.length > 0) {
            try {
                await User.findByIdAndUpdate(
                    req.user.id,
                    {
                        $push: {
                            searchedKeywords: { $each: activityKeywords, $slice: -50 }
                        }
                    },
                    { new: false }
                );
            } catch (err) {
                console.error('Failed to update search activity:', err);
            }
        }
        
        const products = await Product.find(query)
            .populate('sellerId', 'name email college')
            .sort(sort)
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));
            
        const total = await Product.countDocuments(query);
        
        res.json({
            products,
            totalPages: Math.ceil(total / limit),
            currentPage: Number(page),
            totalProducts: total
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('sellerId', 'name email college');
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const isOwner = req.user && product.sellerId && product.sellerId._id.toString() === req.user.id;
        const isAdmin = req.user && req.user.role === 'admin';
        const isPublicStatus = ['approved', 'sold'].includes(product.status);
        if (!isPublicStatus && !isOwner && !isAdmin) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.status === 'approved' && product.isAvailable) {
            await Product.updateOne({ _id: product._id }, { $inc: { views: 1 } });
            product.views = (product.views || 0) + 1;
        }

        if (req.user) {
            try {
                await User.findByIdAndUpdate(
                    req.user.id,
                    {
                        $pull: { viewedProducts: product._id },
                        $push: { viewedProducts: { $each: [product._id], $position: 0, $slice: 50 } }
                    },
                    { new: false }
                );
            } catch (err) {
                console.error('Failed to update viewed products:', err);
            }
        }

        res.json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getUserProducts = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const products = await Product.find({ sellerId: userId }).populate('sellerId', 'name email college');
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getSimilarProducts = async (req, res) => {
    try {
        const { productId } = req.params;
        const limit = clampRecommendLimit(req.query.limit, 8);

        const product = await Product.findById(productId).select('title category');
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const keywords = extractKeywords(product.title);
        const keywordRegex = buildRegexFromKeywords(keywords);

        const orConditions = [{ category: product.category }];
        if (keywordRegex) {
            orConditions.push({ title: { $regex: keywordRegex } });
        }

        const similarProducts = await Product.find({
            ...BASE_PRODUCT_FILTER,
            _id: { $ne: productId },
            $or: orConditions
        })
            .populate('sellerId', 'name email college')
            .limit(limit);

        res.json(similarProducts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getUserRecommendations = async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = clampRecommendLimit(req.query.limit, 8);

        if (!req.user || (req.user.id !== userId && req.user.role !== 'admin')) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const user = await User.findById(userId).select('viewedProducts searchedKeywords');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const viewedIds = (user.viewedProducts || []).slice(0, 50);
        const searchedKeywords = (user.searchedKeywords || []).slice(-50);

        const viewedProducts = viewedIds.length
            ? await Product.find({ _id: { $in: viewedIds } }).select('category')
            : [];
        const categorySignals = [...new Set(viewedProducts.map((p) => p.category).filter(Boolean))];

        const keywordSignals = [...new Set(searchedKeywords.map((k) => (k || '').toString().toLowerCase()).filter(Boolean))];
        const keywordRegex = buildRegexFromKeywords(keywordSignals);

        const orConditions = [];
        if (categorySignals.length) orConditions.push({ category: { $in: categorySignals } });
        if (keywordRegex) {
            orConditions.push({ title: { $regex: keywordRegex } });
            orConditions.push({ category: { $regex: keywordRegex } });
        }

        let recommended;
        if (orConditions.length === 0) {
            recommended = await Product.find(BASE_PRODUCT_FILTER)
                .sort({ views: -1, createdAt: -1 })
                .limit(limit)
                .populate('sellerId', 'name email college');
        } else {
            recommended = await Product.find({
                ...BASE_PRODUCT_FILTER,
                _id: { $nin: viewedIds },
                $or: orConditions
            })
                .sort({ views: -1, createdAt: -1 })
                .limit(limit)
                .populate('sellerId', 'name email college');
        }

        res.json(recommended);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getTrendingProducts = async (req, res) => {
    try {
        const limit = clampRecommendLimit(req.query.limit, 8);
        const trending = await Product.find(BASE_PRODUCT_FILTER)
            .sort({ views: -1, createdAt: -1 })
            .limit(limit)
            .populate('sellerId', 'name email college');
        res.json(trending);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getNewArrivals = async (req, res) => {
    try {
        const limit = clampRecommendLimit(req.query.limit, 8);
        const latest = await Product.find(BASE_PRODUCT_FILTER)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sellerId', 'name email college');
        res.json(latest);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const addProduct = async (req, res) => {
    try {
        const { title, description, price, category, condition } = req.body;
        const images = req.files ? req.files.map(f => f.filename) : [];
        
        const product = new Product({
            title, description, price, category, condition,
            images,
            sellerId: req.user.id,
            status: 'pending' // Default status
        });
        
        await product.save();
        res.status(201).json(product);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        
        if (product.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product removed' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    getSimilarProducts,
    getUserRecommendations,
    getTrendingProducts,
    getNewArrivals,
    addProduct,
    deleteProduct,
    getUserProducts
};
