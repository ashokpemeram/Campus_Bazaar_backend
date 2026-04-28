const Product = require('../models/Product');
const ChatConversation = require('../models/ChatConversation');
const { CATEGORIES } = require('../config/categories');

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CHAT_HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT || 8);
const CHAT_STORE_LIMIT = Number(process.env.CHAT_STORE_LIMIT || 50);
const CHAT_PRODUCT_LIMIT = Number(process.env.CHAT_PRODUCT_LIMIT || 5);

const BASE_PRODUCT_FILTER = { status: 'approved', isAvailable: true };

const SYSTEM_PROMPT = [
    'You are Campus Bazaar, a friendly assistant for a college marketplace app.',
    'Help users buy, sell, and discover products on the platform.',
    'Answer app navigation, account, listings, and order questions clearly.',
    'Be concise, warm, and action-oriented.',
    'Never fabricate specific product listings.',
    'If a question is unclear, ask a short clarifying question.'
].join(' ');

const LOG_PREFIX = '[AI Chat]';

const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'to', 'for', 'from', 'in', 'on', 'at', 'of', 'with',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'they', 'their', 'it', 'its',
    'show', 'find', 'search', 'looking', 'want', 'need', 'buy', 'sell', 'price', 'under',
    'below', 'above', 'over', 'between', 'within', 'budget', 'cheap', 'expensive',
    'how', 'where', 'what', 'when', 'why', 'can', 'could', 'should', 'please', 'help',
    'issue', 'problem', 'error', 'trouble', 'support', 'app', 'application', 'platform',
    'website', 'campus', 'bazaar'
]);

const CATEGORY_SYNONYMS = {
    Electronics: [
        'laptop', 'notebook', 'ultrabook', 'macbook', 'chromebook',
        'phone', 'mobile', 'smartphone', 'iphone', 'android',
        'tablet', 'ipad', 'tab',
        'headphone', 'headphones', 'earphone', 'earphones', 'earbud', 'earbuds', 'airpods', 'headset',
        'camera', 'dslr', 'mirrorless', 'gopro', 'tripod',
        'charger', 'adapter', 'power adapter', 'powerbank', 'power bank', 'cable', 'usb', 'type-c', 'type c',
        'console', 'ps5', 'ps4', 'xbox', 'playstation', 'nintendo', 'switch',
        'monitor', 'screen', 'display', 'pc', 'desktop', 'keyboard', 'mouse', 'trackpad',
        'speaker', 'speakers', 'soundbar', 'bluetooth', 'router', 'wifi', 'modem', 'printer', 'scanner',
        'smartwatch', 'smart watch', 'fitness band', 'fitbit',
        'graphics', 'gpu', 'graphic card', 'graphics card', 'harddisk', 'hard drive', 'hdd', 'ssd', 'storage',
        'memory', 'ram', 'motherboard', 'processor', 'cpu',
        'projector', 'vr', 'drone', 'microphone', 'mic', 'webcam',
        'tv', 'television', 'set top box', 'set-top box',
        'fan', 'heater', 'kettle', 'iron', 'toaster', 'mixer', 'grinder', 'induction',
        'gadget', 'gadgets', 'device', 'devices'
    ],
    Furniture: [
        'chair', 'study chair', 'office chair', 'ergonomic chair', 'table', 'study table', 'desk', 'study desk',
        'sofa', 'couch', 'recliner', 'futon', 'bed', 'mattress', 'wardrobe', 'cupboard',
        'cabinet', 'shelf', 'bookshelf', 'rack', 'shoe rack', 'storage', 'stool', 'bean bag', 'beanbag',
        'nightstand', 'bedside table', 'side table', 'coffee table', 'dining table', 'drawer',
        'pillow', 'cushion'
    ],
    Books: [
        'book', 'textbook', 'novel', 'notes', 'handwritten notes', 'printed notes', 'guide', 'reference',
        'handbook', 'manual', 'question bank', 'exam prep', 'study material',
        'workbook', 'lab manual', 'previous year', 'pyq', 'solution manual', 'reference book',
        'comic', 'magazine', 'journal'
    ],
    Clothing: [
        'shirt', 'tshirt', 't-shirt', 'jeans', 'jacket', 'hoodie',
        'dress', 'kurta', 'kurti', 'sweater', 'sweatshirt', 'coat', 'blazer',
        'saree', 'sari', 'salwar', 'dupatta',
        'pants', 'trousers', 'shorts', 'skirt', 'leggings', 'joggers', 'track pants',
        'shoes', 'sneakers', 'sandals', 'boots',
        'cap', 'hat', 'belt'
    ],
    Tools: [
        'tool', 'toolkit', 'calculator', 'scientific calculator', 'lab', 'lab kit', 'kit', 'instrument',
        'drafting', 'drafing', 'drawing', 'stationery', 'geometry', 'compass', 'set square',
        'engineering kit', 'project kit', 'multimeter', 'soldering', 'breadboard', 'arduino',
        'safety goggles', 'apron'
    ],
    'Sports & Fitness': [
        'sports', 'gym', 'fitness', 'workout', 'exercise', 'yoga', 'yoga mat',
        'dumbbell', 'barbell', 'kettlebell', 'treadmill', 'bench press',
        'cricket', 'cricket bat', 'badminton', 'racquet', 'racket', 'tennis',
        'football', 'basketball', 'volleyball', 'skipping rope', 'jump rope'
    ],
    'Musical Instruments': [
        'guitar', 'acoustic guitar', 'electric guitar', 'bass guitar', 'ukulele',
        'violin', 'cello', 'flute', 'harmonica', 'saxophone', 'trumpet',
        'drum', 'drums', 'drum kit', 'tabla', 'dhol', 'piano', 'synth', 'synthesizer'
    ],
    Vehicles: [
        'bicycle', 'bike', 'cycle', 'scooter', 'moped', 'motorbike', 'motorcycle',
        'vehicle', 'bike helmet', 'cycle helmet', 'bike lock'
    ],
    'Beauty & Personal Care': [
        'skincare', 'skin care', 'makeup', 'cosmetics', 'perfume', 'fragrance', 'deodorant',
        'lotion', 'cream', 'shampoo', 'conditioner', 'hair oil', 'haircare', 'face wash',
        'sunscreen', 'lipstick', 'foundation', 'moisturizer', 'soap', 'body wash'
    ]
};

const FAQ_ENTRIES = [
    {
        intent: 'app_cart',
        requireHelpContext: true,
        patterns: [
            /where.*cart/i,
            /open cart/i,
            /cart page/i,
            /checkout page/i,
            /go to cart/i,
            /\bcart\b/i,
            /\bbasket\b/i,
            /\bbag\b/i,
            /\bcheckout\b/i,
            /view cart/i,
            /my cart/i,
            /add to cart/i
        ],
        reply: 'Open the cart icon in the navbar to review items, then checkout to place the order.'
    },
    {
        intent: 'app_dashboard',
        requireHelpContext: true,
        patterns: [/dashboard/i, /my account/i, /account page/i, /\baccount\b/i, /profile page/i],
        reply: 'Open Dashboard from the navbar to manage listings, orders, wishlist, messages, and settings.'
    },
    {
        intent: 'app_wishlist',
        requireHelpContext: true,
        patterns: [/wishlist/i, /favorite/i, /favourite/i, /save for later/i, /saved items/i, /saved item/i, /heart icon/i],
        reply: 'Tap the heart icon on any listing to add it to Wishlist. View it from the navbar or Dashboard > Wishlist.'
    },
    {
        intent: 'app_messages',
        requireHelpContext: true,
        patterns: [
            /message/i,
            /messages/i,
            /\bchat\b/i,
            /inbox/i,
            /contact seller/i,
            /message seller/i,
            /dm/i,
            /direct message/i
        ],
        reply: 'Use Messages from the navbar or Dashboard > Messages. You can also open a listing and message the seller directly.'
    },
    {
        intent: 'app_notifications',
        requireHelpContext: true,
        patterns: [/notification/i, /notifications/i, /alert/i, /alerts/i, /bell/i, /push notification/i, /email notification/i, /sms/i],
        reply: 'You will see updates in Messages and My Orders. If you do not see a bell icon, that is expected in the current UI.'
    },
    {
        intent: 'app_orders',
        requireHelpContext: true,
        patterns: [
            /my orders/i,
            /order status/i,
            /track/i,
            /tracking/i,
            /seller orders/i,
            /order update/i,
            /order history/i,
            /purchase history/i,
            /my purchases/i
        ],
        reply: 'Check Dashboard > My Orders to track purchases. Sellers can manage requests in Dashboard > Seller Orders.'
    },
    {
        intent: 'app_listing_status',
        requireHelpContext: true,
        patterns: [
            /pending/i,
            /approved/i,
            /rejected/i,
            /listing status/i,
            /status of .*listing/i,
            /listing review/i,
            /approval status/i,
            /my listings/i
        ],
        reply: 'New listings are reviewed before approval. Check Dashboard > My Listings to see pending or approved status.'
    },
    {
        intent: 'app_edit_listing',
        requireHelpContext: true,
        patterns: [/edit listing/i, /update listing/i, /change listing/i, /modify listing/i, /edit product/i, /update product/i],
        reply: 'Go to Dashboard > My Listings and use the pencil icon to edit details. Save changes to update the listing.'
    },
    {
        intent: 'app_delete_listing',
        requireHelpContext: true,
        patterns: [/delete listing/i, /remove listing/i, /delete product/i, /remove product/i, /take down/i, /unlist/i, /delist/i],
        reply: 'Go to Dashboard > My Listings, click the trash icon, and confirm. You can post the item again later if needed.'
    },
    {
        intent: 'app_profile',
        requireHelpContext: true,
        patterns: [
            /profile/i,
            /settings/i,
            /account settings/i,
            /change password/i,
            /update profile/i,
            /edit profile/i,
            /change email/i,
            /change phone/i
        ],
        reply: 'Update your profile details and password from Dashboard > Settings.'
    },
    {
        intent: 'faq_buying',
        requireHelpContext: true,
        patterns: [
            /buy/i,
            /purchase/i,
            /checkout/i,
            /place order/i,
            /order process/i,
            /cart/i,
            /how .*buy/i,
            /how .*order/i,
            /where .*buy/i
        ],
        reply: 'To buy an item, open a product, add it to your cart, and checkout. You can also message sellers directly from the listing.'
    },
    {
        intent: 'faq_selling',
        requireHelpContext: true,
        patterns: [
            /sell/i,
            /list/i,
            /post/i,
            /add product/i,
            /create listing/i,
            /upload/i,
            /how .*sell/i,
            /how .*list/i,
            /post .*listing/i
        ],
        reply: 'To sell, open "Add Product", fill in details and photos, then submit. Listings are reviewed before they go live.'
    },
    {
        intent: 'faq_login',
        requireHelpContext: true,
        patterns: [
            /login/i,
            /log in/i,
            /sign in/i,
            /sign up/i,
            /signup/i,
            /register/i,
            /create account/i,
            /password/i,
            /otp/i,
            /verify/i,
            /verification/i,
            /verification code/i,
            /email/i,
            /forgot/i,
            /reset/i,
            /resend otp/i
        ],
        reply: 'If you cannot log in, verify your college email and request a fresh OTP. You can also reset your password from the login screen.'
    },
    {
        intent: 'faq_payment',
        requireHelpContext: true,
        patterns: [
            /payment/i,
            /pay/i,
            /upi/i,
            /card/i,
            /cash/i,
            /cash on delivery/i,
            /\bcod\b/i,
            /online payment/i
        ],
        reply: 'Payments are currently COD (cash on delivery). Coordinate payment and pickup with the seller after placing the order.'
    },
    {
        intent: 'faq_delivery',
        requireHelpContext: true,
        patterns: [/delivery/i, /shipping/i, /pickup/i, /meet/i, /meetup/i, /handover/i, /drop/i, /dispatch/i],
        reply: 'Most campus transactions are arranged as on-campus pickup. Coordinate a safe meeting point via Messages.'
    },
    {
        intent: 'faq_support',
        requireHelpContext: true,
        patterns: [/support/i, /helpdesk/i, /report/i, /scam/i, /fraud/i, /issue/i, /bug/i, /complaint/i],
        reply: 'If you run into issues, message the seller first, then reach out via the support options in your dashboard.'
    },
    {
        intent: 'app_about',
        requireHelpContext: true,
        patterns: [/what is campus bazaar/i, /how does .*work/i, /about campus bazaar/i, /about the app/i, /campus bazaar/i],
        reply: 'Campus Bazaar is a student marketplace where you can buy and sell within your college. Browse products, post listings, and chat with sellers.'
    }
];

const getRequestId = (req) => {
    if (req.aiRequestId) return req.aiRequestId;
    const headerId = req.headers['x-request-id'];
    if (typeof headerId === 'string' && headerId.trim()) {
        req.aiRequestId = headerId.trim();
        return req.aiRequestId;
    }
    req.aiRequestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return req.aiRequestId;
};

const logInfo = (requestId, message, meta) => {
    if (meta !== undefined) {
        console.log(`${LOG_PREFIX} ${requestId} ${message}`, meta);
        return;
    }
    console.log(`${LOG_PREFIX} ${requestId} ${message}`);
};

const logWarn = (requestId, message, meta) => {
    if (meta !== undefined) {
        console.warn(`${LOG_PREFIX} ${requestId} ${message}`, meta);
        return;
    }
    console.warn(`${LOG_PREFIX} ${requestId} ${message}`);
};

const logError = (requestId, message, meta) => {
    if (meta !== undefined) {
        console.error(`${LOG_PREFIX} ${requestId} ${message}`, meta);
        return;
    }
    console.error(`${LOG_PREFIX} ${requestId} ${message}`);
};

const normalizeText = (value, maxLen = 800) => {
    const text = (value || '').toString().trim();
    if (!text) return '';
    return maxLen && text.length > maxLen ? text.slice(0, maxLen) : text;
};

const createConversationId = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sanitizeHistory = (history) => {
    if (!Array.isArray(history)) return [];
    return history
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
        .map((item) => ({
            role: item.role,
            content: normalizeText(item.content, 600)
        }))
        .filter((item) => item.content)
        .slice(-CHAT_HISTORY_LIMIT);
};

const extractKeywords = (text) => {
    const tokens = (text || '').match(/[a-z0-9]+/gi) || [];
    const keywords = tokens
        .map((token) => token.toLowerCase())
        .filter((token) => token.length > 2 && !stopWords.has(token));
    return [...new Set(keywords)];
};

const detectCategory = (text) => {
    const lowered = (text || '').toLowerCase();
    const direct = CATEGORIES.find((cat) => lowered.includes(cat.toLowerCase()));
    if (direct) return direct;

    for (const [category, keywords] of Object.entries(CATEGORY_SYNONYMS)) {
        if (keywords.some((word) => lowered.includes(word))) return category;
    }
    return null;
};

const parseMoneyValue = (raw) => {
    if (!raw) return null;
    const cleaned = raw.toString().replace(/[,\u20B9\s]/g, '').toLowerCase();
    const numberMatch = cleaned.match(/\d+(?:\.\d+)?/);
    if (!numberMatch) return null;
    let value = Number(numberMatch[0]);
    if (!Number.isFinite(value)) return null;
    if (cleaned.includes('lakh')) value *= 100000;
    else if (cleaned.includes('k')) value *= 1000;
    else if (cleaned.includes('m')) value *= 1000000;
    return Math.round(value);
};

const extractPriceRange = (text) => {
    const lower = (text || '').toLowerCase();
    const betweenRegex = /between\s+([\d.,]+\s*(?:k|lakh|lakhs|m)?)\s*(?:and|to|-)\s*([\d.,]+\s*(?:k|lakh|lakhs|m)?)/i;
    const rangeRegex = /([\d.,]+\s*(?:k|lakh|lakhs|m)?)\s*(?:-|to)\s*([\d.,]+\s*(?:k|lakh|lakhs|m)?)/i;
    const underRegex = /(?:under|below|less than|upto|up to|max(?:imum)?(?: price)?|budget)\s*\u20B9?\s*([\d.,]+\s*(?:k|lakh|lakhs|m)?)/i;
    const overRegex = /(?:above|over|more than|min(?:imum)?(?: price)?|starting from|at least)\s*\u20B9?\s*([\d.,]+\s*(?:k|lakh|lakhs|m)?)/i;

    const betweenMatch = lower.match(betweenRegex);
    if (betweenMatch) {
        const minPrice = parseMoneyValue(betweenMatch[1]);
        const maxPrice = parseMoneyValue(betweenMatch[2]);
        if (minPrice || maxPrice) return { minPrice, maxPrice };
    }

    const rangeMatch = lower.match(rangeRegex);
    if (rangeMatch) {
        const minPrice = parseMoneyValue(rangeMatch[1]);
        const maxPrice = parseMoneyValue(rangeMatch[2]);
        if (minPrice || maxPrice) return { minPrice, maxPrice };
    }

    const underMatch = lower.match(underRegex);
    if (underMatch) {
        const maxPrice = parseMoneyValue(underMatch[1]);
        if (maxPrice) return { minPrice: null, maxPrice };
    }

    const overMatch = lower.match(overRegex);
    if (overMatch) {
        const minPrice = parseMoneyValue(overMatch[1]);
        if (minPrice) return { minPrice, maxPrice: null };
    }

    return { minPrice: null, maxPrice: null };
};

const buildKeywordRegex = (keywords) => {
    if (!keywords || keywords.length === 0) return null;
    const pattern = keywords.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (!pattern) return null;
    return new RegExp(pattern, 'i');
};

const isGreeting = (text) => /^(hi|hello|hey|yo|good morning|good evening|good afternoon)\b/i.test(text || '');

const HELP_CONTEXT_REGEX = /(\?|how|where|what|when|why|can i|could i|do i|should i|help|issue|problem|error|trouble|unable|can't|cannot|not working|guide|steps|process|reset|forgot)/i;
const APP_CONTEXT_REGEX = /\b(dashboard|wishlist|favorite|favourite|saved items?|cart|basket|checkout|orders?|order status|tracking|messages?|inbox|profile|settings?|login|log in|sign in|sign up|signup|register|otp|verification|email|password|reset|forgot|add product|post listing|create listing|my listings|seller orders|listing status|approval|pending|rejected|edit listing|update listing|delete listing|remove listing|unlist|delist|edit product|delete product|notifications?|alerts?|bell|support|helpdesk|report|scam|fraud|payment|cod|cash on delivery|delivery|shipping|pickup)\b/i;

const isHelpContext = (text) => HELP_CONTEXT_REGEX.test(text || '');
const isAppContext = (text) => APP_CONTEXT_REGEX.test(text || '');

const findFaqResponse = (text) => {
    const helpContext = isHelpContext(text) || isAppContext(text);
    for (const entry of FAQ_ENTRIES) {
        if (entry.requireHelpContext && !helpContext) {
            continue;
        }
        if (entry.patterns.some((pattern) => pattern.test(text))) {
            return entry;
        }
    }
    return null;
};

const detectProductIntent = (text) => {
    const lower = (text || '').toLowerCase();
    const hasSearchVerb = /(show|find|search|looking for|looking to buy|looking to sell|looking|need|want|recommend|suggest|available|list|any|buy|sell|purchase|rent|for sale|second hand|secondhand|used|preowned|pre-owned|in stock)/i.test(lower);
    const { minPrice, maxPrice } = extractPriceRange(lower);
    const category = detectCategory(lower);
    const keywords = extractKeywords(lower);
    const hasSignal = Boolean(category || minPrice || maxPrice || keywords.length);
    const helpContext = isHelpContext(lower);
    const appContext = isAppContext(lower);
    let isProductQuery = hasSignal && (hasSearchVerb || Boolean(minPrice || maxPrice || category || keywords.length));

    if ((helpContext || appContext) && !minPrice && !maxPrice && !category) {
        isProductQuery = false;
    }
    return { isProductQuery, category, minPrice, maxPrice, keywords };
};

const fetchProductsForIntent = async ({ category, minPrice, maxPrice, keywords }) => {
    const query = { ...BASE_PRODUCT_FILTER };
    if (category) query.category = category;
    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    const keywordRegex = buildKeywordRegex(keywords);
    if (keywordRegex) {
        query.$or = [{ title: { $regex: keywordRegex } }, { description: { $regex: keywordRegex } }];
    }

    const products = await Product.find(query)
        .select('title price description category images')
        .sort({ createdAt: -1 })
        .limit(CHAT_PRODUCT_LIMIT);

    return products.map((product) => ({
        _id: product._id,
        title: product.title,
        price: product.price,
        category: product.category,
        description: (product.description || '').slice(0, 120),
        image: product.images?.[0] || null
    }));
};

const buildProductReply = (products, { category, minPrice, maxPrice }) => {
    if (!products || products.length === 0) {
        return 'I could not find matching items right now. Try adjusting the category or price range, or ask for something similar.';
    }

    const parts = [];
    if (category) parts.push(category.toLowerCase());
    if (minPrice || maxPrice) {
        if (minPrice && maxPrice) parts.push(`INR ${minPrice}-${maxPrice}`);
        else if (minPrice) parts.push(`above INR ${minPrice}`);
        else if (maxPrice) parts.push(`under INR ${maxPrice}`);
    }

    const summary = parts.length ? `Here are some ${parts.join(' ')} options:` : 'Here are a few options I found:';
    return summary;
};

let openaiClient;
const getClient = async () => {
    if (openaiClient) return openaiClient;
    const { default: OpenAI } = await import('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openaiClient;
};

const extractChatContent = (response) => {
    if (!response || !Array.isArray(response.choices)) return '';
    return response.choices[0]?.message?.content || '';
};

const callOpenAI = async (messages) => {
    const client = await getClient();
    if (!client) return '';
    if (typeof client.responses?.create === 'function') {
        const response = await client.responses.create({
            model: CHAT_MODEL,
            input: messages,
            temperature: 0.4,
            max_output_tokens: 300
        });
        return response.output_text || '';
    }
    if (typeof client.chat?.completions?.create === 'function') {
        const response = await client.chat.completions.create({
            model: CHAT_MODEL,
            messages,
            temperature: 0.4,
            max_tokens: 300
        });
        return extractChatContent(response);
    }
    return '';
};

const saveMessage = async ({ conversationId, userId, message }) => {
    if (!conversationId) return null;
    try {
        await ChatConversation.findOneAndUpdate(
            { conversationId },
            {
                $setOnInsert: { conversationId, userId: userId || null },
                $push: {
                    messages: {
                        $each: [message],
                        $slice: -CHAT_STORE_LIMIT
                    }
                }
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.warn(`${LOG_PREFIX} failed to save message`, err?.message);
    }
    return null;
};

const handleChat = async (req, res) => {
    const requestId = getRequestId(req);
    const startedAt = Date.now();
    const userId = req.user?.id || null;
    try {
        const message = normalizeText(req.body?.message, 800);
        const conversationId = normalizeText(req.body?.conversationId, 100) || createConversationId();
        const history = sanitizeHistory(req.body?.history);

        if (!message) {
            return res.status(400).json({ message: 'Message is required.' });
        }

        logInfo(requestId, 'incoming', { conversationId, userId, messageLength: message.length });

        const productIntent = detectProductIntent(message);
        const faqEntry = findFaqResponse(message);

        await saveMessage({
            conversationId,
            userId,
            message: { role: 'user', content: message, intent: productIntent.isProductQuery ? 'product_search' : faqEntry?.intent || 'chat' }
        });

        if (productIntent.isProductQuery) {
            const products = await fetchProductsForIntent(productIntent);
            const reply = buildProductReply(products, productIntent);

            await saveMessage({
                conversationId,
                userId,
                message: {
                    role: 'assistant',
                    content: reply,
                    intent: 'product_search',
                    products: products.map((item) => ({ productId: item._id, title: item.title, price: item.price }))
                }
            });

            logInfo(requestId, 'product response', { count: products.length });
            return res.json({
                reply,
                intent: 'product_search',
                products,
                conversationId,
                usedOpenAI: false
            });
        }

        if (faqEntry) {
            await saveMessage({
                conversationId,
                userId,
                message: { role: 'assistant', content: faqEntry.reply, intent: faqEntry.intent }
            });

            logInfo(requestId, 'faq response', { intent: faqEntry.intent });
            return res.json({
                reply: faqEntry.reply,
                intent: faqEntry.intent,
                products: [],
                conversationId,
                usedOpenAI: false
            });
        }

        if (isGreeting(message)) {
            const greetingReply = 'Hi! I can help you find products, post listings, or answer questions about Campus Bazaar. What are you looking for?';
            await saveMessage({
                conversationId,
                userId,
                message: { role: 'assistant', content: greetingReply, intent: 'greeting' }
            });
            return res.json({
                reply: greetingReply,
                intent: 'greeting',
                products: [],
                conversationId,
                usedOpenAI: false
            });
        }

        if (!process.env.OPENAI_API_KEY) {
            const fallbackReply = 'I can help with buying, selling, or finding items. Try asking: "show laptops under 50000" or "how do I post an item?"';
            await saveMessage({
                conversationId,
                userId,
                message: { role: 'assistant', content: fallbackReply, intent: 'fallback' }
            });
            logWarn(requestId, 'OPENAI_API_KEY missing');
            return res.json({
                reply: fallbackReply,
                intent: 'fallback',
                products: [],
                conversationId,
                usedOpenAI: false
            });
        }

        const openaiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: message }
        ];

        let aiReply = '';
        let usedOpenAI = true;
        try {
            aiReply = normalizeText(await callOpenAI(openaiMessages), 1200);
        } catch (err) {
            usedOpenAI = false;
            logWarn(requestId, 'openai failed, using fallback', { message: err?.message });
        }

        if (!aiReply) {
            aiReply = 'Thanks for the question! Could you share a bit more so I can help you better?';
            usedOpenAI = false;
        }

        await saveMessage({
            conversationId,
            userId,
            message: { role: 'assistant', content: aiReply, intent: 'assistant' }
        });

        logInfo(requestId, 'openai response', { durationMs: Date.now() - startedAt });
        return res.json({
            reply: aiReply,
            intent: 'assistant',
            products: [],
            conversationId,
            usedOpenAI
        });
    } catch (err) {
        logError(requestId, 'error', { message: err?.message, stack: err?.stack });
        return res.status(500).json({ message: 'Chat service error. Please try again.' });
    }
};

const getChatQueries = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const conversations = await ChatConversation.find()
            .sort({ updatedAt: -1 })
            .limit(60)
            .lean();

        const queries = [];
        for (const convo of conversations) {
            for (const msg of convo.messages || []) {
                if (msg.role === 'user') {
                    queries.push({
                        conversationId: convo.conversationId,
                        userId: convo.userId || null,
                        message: msg.content,
                        intent: msg.intent || null,
                        createdAt: msg.createdAt || convo.updatedAt
                    });
                }
            }
        }

        queries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ queries: queries.slice(0, limit) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { handleChat, getChatQueries };
