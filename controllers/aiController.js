const crypto = require('crypto');
const Product = require('../models/Product');

const PRICE_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const CACHE_TTL_MS = Number(process.env.AI_SUGGESTION_CACHE_TTL_MS || 10 * 60 * 1000);

const aiCache = new Map();
const LOG_PREFIX = '[AI Suggest]';

const getRequestId = (req) => {
    if (req.aiRequestId) return req.aiRequestId;
    const headerId = req.headers['x-request-id'];
    if (typeof headerId === 'string' && headerId.trim()) {
        req.aiRequestId = headerId.trim();
        return req.aiRequestId;
    }
    req.aiRequestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

const normalizeText = (value, maxLen) => {
    const text = (value || '').toString().trim();
    if (maxLen && text.length > maxLen) return text.slice(0, maxLen);
    return text;
};

const buildCacheKey = (payload) => {
    const normalized = {
        title: normalizeText(payload.title, 200).toLowerCase(),
        description: normalizeText(payload.description, 1000).toLowerCase(),
        category: normalizeText(payload.category, 80).toLowerCase(),
        condition: normalizeText(payload.condition, 40).toLowerCase()
    };
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
};

const getCachedSuggestion = (key) => {
    const entry = aiCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        aiCache.delete(key);
        return null;
    }
    return entry.value;
};

const setCachedSuggestion = (key, value) => {
    aiCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const sanitizePrice = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.round(num);
};

const clampPrice = (value, min = 50, max = 200000) => {
    if (value == null) return null;
    return Math.min(max, Math.max(min, value));
};

const finalizeAiSuggestion = (raw) => {
    let suggestedPrice = clampPrice(sanitizePrice(raw.suggestedPrice));
    let minPrice = clampPrice(sanitizePrice(raw.minPrice));
    let maxPrice = clampPrice(sanitizePrice(raw.maxPrice));
    const reason = normalizeText(raw.reason, 240) || 'Based on product details and condition.';

    if (suggestedPrice == null) {
        suggestedPrice = 1000;
    }
    if (minPrice == null) minPrice = Math.round(suggestedPrice * 0.85);
    if (maxPrice == null) maxPrice = Math.round(suggestedPrice * 1.15);

    if (minPrice > suggestedPrice) minPrice = Math.round(suggestedPrice * 0.85);
    if (maxPrice < suggestedPrice) maxPrice = Math.round(suggestedPrice * 1.15);
    if (minPrice > maxPrice) {
        const temp = minPrice;
        minPrice = maxPrice;
        maxPrice = temp;
    }

    return {
        suggestedPrice: clampPrice(suggestedPrice),
        minPrice: clampPrice(minPrice),
        maxPrice: clampPrice(maxPrice),
        reason
    };
};

const fallbackSuggestion = (payload) => {
    const category = normalizeText(payload.category, 80).toLowerCase();
    const condition = normalizeText(payload.condition, 40).toLowerCase();

    const baseByCategory = {
        electronics: 5000,
        books: 300,
        clothing: 600,
        'dorm essentials': 800,
        tools: 1200
    };

    const multiplierByCondition = {
        new: 1.0,
        'like new': 0.85,
        good: 0.7,
        used: 0.6,
        fair: 0.55,
        poor: 0.45
    };

    const base = baseByCategory[category] || 1000;
    const multiplier = multiplierByCondition[condition] || 0.65;
    const suggested = Math.round(base * multiplier);

    return finalizeAiSuggestion({
        suggestedPrice: suggested,
        minPrice: Math.round(suggested * 0.85),
        maxPrice: Math.round(suggested * 1.15),
        reason: 'Fallback estimate based on category, condition, and typical student budgets.'
    });
};

const fetchSimilarProducts = async (category) => {
    const normalizedCategory = normalizeText(category, 80);
    const approvedProducts = await Product.find({ category: normalizedCategory, status: 'approved' }).select('price');
    return { products: approvedProducts, source: 'approved' };
};

const calculateAveragePrice = (products) => {
    if (!products || products.length === 0) return 0;
    const sum = products.reduce((total, product) => total + Number(product.price || 0), 0);
    return sum / products.length;
};

const normalizeCondition = (condition) => normalizeText(condition, 40).toLowerCase().trim();

const formatConditionLabel = (normalizedCondition) => {
    if (!normalizedCondition) return null;
    return normalizedCondition
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const getDepreciationMultiplier = (normalizedCondition) => {
    switch (normalizedCondition) {
        case 'new':
            return 0.9;
        case 'like new':
            return 0.75;
        case 'good':
            return 0.65;
        case 'used':
            return 0.5;
        case 'fair':
            return 0.4;
        case 'poor':
            return 0.25;
        default:
            return 0.5;
    }
};

const calculateDepreciationInfo = (originalPrice, condition) => {
    if (!originalPrice || !Number.isFinite(originalPrice) || originalPrice <= 0) {
        return { depreciatedPrice: 0, conditionApplied: null, depreciationPercent: null };
    }

    const normalizedCondition = normalizeCondition(condition);
    const multiplier = getDepreciationMultiplier(normalizedCondition);
    const depreciatedPrice = Math.round(originalPrice * multiplier);
    const conditionApplied = formatConditionLabel(normalizedCondition);
    const depreciationPercent = `${Math.round(multiplier * 100)}%`;

    return { depreciatedPrice, conditionApplied, depreciationPercent };
};

const calculateFinalPrice = ({ aiPrice, avgPrice, originalPrice, depreciatedPrice }) => {
    let finalPrice;

    if (avgPrice > 0 && depreciatedPrice > 0) {
        finalPrice = Math.round(avgPrice * 0.7 + depreciatedPrice * 0.3);
    } else if (avgPrice > 0) {
        finalPrice = Math.round(avgPrice);
    } else if (depreciatedPrice > 0) {
        finalPrice = Math.round(depreciatedPrice);
    } else {
        finalPrice = aiPrice;
    }

    if (originalPrice && finalPrice > originalPrice) {
        finalPrice = Math.round(originalPrice);
    }
    if (originalPrice && finalPrice < originalPrice * 0.3) {
        finalPrice = Math.round(originalPrice * 0.3);
    }

    const maxAllowed = 200000;
    if (finalPrice > maxAllowed) finalPrice = maxAllowed;
    if (!originalPrice && finalPrice < 50) finalPrice = 50;

    return finalPrice;
};

const buildFinalSuggestion = ({
    aiSuggestion,
    avgPrice,
    originalPrice,
    depreciatedPrice,
    conditionApplied,
    depreciationPercent
}) => {
    const finalPrice = calculateFinalPrice({
        aiPrice: aiSuggestion.suggestedPrice,
        avgPrice,
        originalPrice,
        depreciatedPrice
    });

    const minPrice = Math.round(finalPrice * 0.85);
    const maxPrice = Math.round(finalPrice * 1.15);

    let confidence = 'Low';
    if (avgPrice > 5) confidence = 'High';
    else if (avgPrice > 2) confidence = 'Medium';

    const aiUsed = !(avgPrice > 0 || depreciatedPrice > 0);

    let reason;
    if (avgPrice > 0 && depreciatedPrice > 0) {
        reason = 'Price based mainly on similar listings and depreciation.';
    } else if (avgPrice > 0) {
        reason = 'Price based mainly on similar listings.';
    } else if (depreciatedPrice > 0) {
        reason = 'Price based mainly on depreciation from original price.';
    } else {
        reason = 'Price based on AI estimate (no market or original price data).';
    }

    return {
        suggestedPrice: finalPrice,
        minPrice,
        maxPrice,
        confidence,
        conditionApplied: conditionApplied || null,
        depreciationPercent: depreciationPercent || null,
        breakdown: {
            avgMarketPrice: avgPrice,
            originalPrice: originalPrice || null,
            depreciatedPrice: originalPrice ? Math.round(depreciatedPrice) : 0,
            aiUsed,
            conditionApplied: conditionApplied || null,
            depreciationPercent: depreciationPercent || null
        },
        reason
    };
};

const buildPrompt = (payload) => {
    return {
        system: [
            'You are an assistant that suggests prices for second-hand student marketplace items in India.',
            'Based on the product details, suggest a fair selling price in INR.',
            'Consider: product type, used condition, typical student budget, and depreciation.',
            'Return ONLY JSON with keys: suggestedPrice, minPrice, maxPrice, reason.'
        ].join(' '),
        user: [
            'Product Details:',
            `Title: ${payload.title}`,
            `Description: ${payload.description}`,
            `Category: ${payload.category}`,
            `Condition: ${payload.condition}`
        ].join('\n')
    };
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

const suggestPrice = async (req, res) => {
    const requestId = getRequestId(req);
    const startedAt = Date.now();
    try {
        logInfo(requestId, 'start', { userId: req.user?.id || null, ip: req.ip });
        const title = normalizeText(req.body?.title, 200);
        const description = normalizeText(req.body?.description, 1000);
        const category = normalizeText(req.body?.category, 80);
        const condition = normalizeText(req.body?.condition, 40);
        const originalPriceRaw = req.body?.originalPrice;
        const hasOriginalPrice = originalPriceRaw !== undefined && originalPriceRaw !== null && originalPriceRaw !== '';
        const originalPrice = hasOriginalPrice ? Number(originalPriceRaw) : 0;

        logInfo(requestId, 'payload', {
            title,
            category,
            condition,
            descriptionLen: description.length,
            hasOriginalPrice,
            originalPrice: hasOriginalPrice ? originalPrice : null
        });

        if (!title || !description || !category || !condition) {
            logWarn(requestId, 'validation failed', {
                title: Boolean(title),
                description: Boolean(description),
                category: Boolean(category),
                condition: Boolean(condition)
            });
            return res.status(400).json({ message: 'Title, description, category, and condition are required.' });
        }
        if (hasOriginalPrice && (!Number.isFinite(originalPrice) || originalPrice <= 0)) {
            logWarn(requestId, 'invalid originalPrice', { originalPriceRaw });
            return res.status(400).json({ message: 'Original price must be a positive number.' });
        }

        const cacheKey = buildCacheKey({ title, description, category, condition });
        const cachedAi = getCachedSuggestion(cacheKey);
        let aiSuggestion = cachedAi;
        logInfo(requestId, 'cache lookup', { hit: Boolean(cachedAi) });

        if (!aiSuggestion && !process.env.OPENAI_API_KEY) {
            logWarn(requestId, 'OPENAI_API_KEY missing, using fallback');
            aiSuggestion = fallbackSuggestion({ title, description, category, condition });
            setCachedSuggestion(cacheKey, aiSuggestion);
        }

        if (!aiSuggestion && process.env.OPENAI_API_KEY) {
            const prompt = buildPrompt({ title, description, category, condition });
            const client = await getClient();
            try {
                let outputText = '';
                if (typeof client.responses?.create === 'function') {
                    logInfo(requestId, 'openai request', { model: PRICE_MODEL, api: 'responses' });
                    const response = await client.responses.create({
                        model: PRICE_MODEL,
                        input: [
                            { role: 'system', content: prompt.system },
                            { role: 'user', content: prompt.user }
                        ],
                        text: {
                            format: {
                                type: 'json_schema',
                                strict: true,
                                schema: {
                                    type: 'object',
                                    properties: {
                                        suggestedPrice: { type: 'number' },
                                        minPrice: { type: 'number' },
                                        maxPrice: { type: 'number' },
                                        reason: { type: 'string' }
                                    },
                                    required: ['suggestedPrice', 'minPrice', 'maxPrice', 'reason'],
                                    additionalProperties: false
                                }
                            }
                        },
                        temperature: 0.2,
                        max_output_tokens: 200
                    });
                    outputText = response.output_text || '';
                } else if (typeof client.chat?.completions?.create === 'function') {
                    logInfo(requestId, 'openai request', { model: PRICE_MODEL, api: 'chat.completions' });
                    const response = await client.chat.completions.create({
                        model: PRICE_MODEL,
                        messages: [
                            { role: 'system', content: prompt.system },
                            { role: 'user', content: prompt.user }
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.2,
                        max_tokens: 200
                    });
                    outputText = extractChatContent(response);
                } else {
                    logWarn(requestId, 'openai client missing responses/chat, using fallback');
                }

                logInfo(requestId, 'openai response received', { outputTextLength: outputText.length });
                let parsed;
                try {
                    parsed = JSON.parse(outputText);
                } catch (err) {
                    logWarn(requestId, 'openai parse failed, using fallback', {
                        outputPreview: outputText.slice(0, 120)
                    });
                    aiSuggestion = fallbackSuggestion({ title, description, category, condition });
                    setCachedSuggestion(cacheKey, aiSuggestion);
                }

                if (parsed) {
                    aiSuggestion = finalizeAiSuggestion(parsed);
                    setCachedSuggestion(cacheKey, aiSuggestion);
                    logInfo(requestId, 'openai parsed', {
                        suggestedPrice: aiSuggestion.suggestedPrice,
                        minPrice: aiSuggestion.minPrice,
                        maxPrice: aiSuggestion.maxPrice
                    });
                }
            } catch (err) {
                logError(requestId, 'openai request failed, using fallback', {
                    message: err?.message,
                    stack: err?.stack
                });
                aiSuggestion = fallbackSuggestion({ title, description, category, condition });
                setCachedSuggestion(cacheKey, aiSuggestion);
            }
        }

        if (!aiSuggestion) {
            logWarn(requestId, 'aiSuggestion missing after openai/fallback, using fallback');
            aiSuggestion = fallbackSuggestion({ title, description, category, condition });
            setCachedSuggestion(cacheKey, aiSuggestion);
        }

        const { products } = await fetchSimilarProducts(category);
        logInfo(requestId, 'similar products fetched', { count: products.length });
        const avgPrice = calculateAveragePrice(products);
        const depreciationInfo = calculateDepreciationInfo(originalPrice, condition);
        const depreciatedPrice = depreciationInfo.depreciatedPrice;
        logInfo(requestId, 'price signals', {
            avgPrice,
            originalPrice: hasOriginalPrice ? originalPrice : null,
            depreciatedPrice,
            conditionApplied: depreciationInfo.conditionApplied,
            depreciationPercent: depreciationInfo.depreciationPercent
        });
        const finalSuggestion = buildFinalSuggestion({
            aiSuggestion,
            avgPrice,
            originalPrice: hasOriginalPrice ? originalPrice : 0,
            depreciatedPrice,
            conditionApplied: depreciationInfo.conditionApplied,
            depreciationPercent: depreciationInfo.depreciationPercent
        });

        logInfo(requestId, 'final suggestion', {
            suggestedPrice: finalSuggestion.suggestedPrice,
            minPrice: finalSuggestion.minPrice,
            maxPrice: finalSuggestion.maxPrice,
            confidence: finalSuggestion.confidence,
            aiUsed: finalSuggestion.breakdown?.aiUsed
        });
        logInfo(requestId, 'done', { durationMs: Date.now() - startedAt });
        return res.json(finalSuggestion);
    } catch (err) {
        logError(requestId, 'error', { message: err?.message, stack: err?.stack });
        const fallback = fallbackSuggestion({
            title: req.body?.title,
            description: req.body?.description,
            category: req.body?.category,
            condition: req.body?.condition
        });
        const originalPriceRaw = req.body?.originalPrice;
        const hasOriginalPrice = originalPriceRaw !== undefined && originalPriceRaw !== null && originalPriceRaw !== '';
        const originalPrice = hasOriginalPrice ? Number(originalPriceRaw) : 0;
        const depreciationInfo = calculateDepreciationInfo(originalPrice, req.body?.condition);
        logInfo(requestId, 'fallback response', {
            suggestedPrice: fallback.suggestedPrice,
            minPrice: fallback.minPrice,
            maxPrice: fallback.maxPrice
        });
        logInfo(requestId, 'done', { durationMs: Date.now() - startedAt, error: true });
        return res.json({
            suggestedPrice: fallback.suggestedPrice,
            minPrice: fallback.minPrice,
            maxPrice: fallback.maxPrice,
            confidence: 'Low',
            conditionApplied: depreciationInfo.conditionApplied,
            depreciationPercent: depreciationInfo.depreciationPercent,
            breakdown: {
                avgMarketPrice: 0,
                originalPrice: hasOriginalPrice ? originalPrice : null,
                depreciatedPrice: depreciationInfo.depreciatedPrice,
                aiUsed: false,
                conditionApplied: depreciationInfo.conditionApplied,
                depreciationPercent: depreciationInfo.depreciationPercent
            },
            reason: 'Based on fallback estimate due to a pricing service error.'
        });
    }
};

module.exports = { suggestPrice };
