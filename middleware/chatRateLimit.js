const RATE_LIMIT_WINDOW_MS = Number(
    process.env.CHAT_RATE_LIMIT_WINDOW_MS || process.env.AI_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000
);
const RATE_LIMIT_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX || process.env.AI_RATE_LIMIT_MAX || 10);

const buckets = new Map();
const LOG_PREFIX = '[AI Chat]';

const getKey = (req) => req.user?.id || req.ip || 'anonymous';

const ensureRequestId = (req) => {
    if (req.aiRequestId) return req.aiRequestId;
    const headerId = req.headers['x-request-id'];
    if (typeof headerId === 'string' && headerId.trim()) {
        req.aiRequestId = headerId.trim();
        return req.aiRequestId;
    }
    req.aiRequestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return req.aiRequestId;
};

const chatRateLimit = (req, res, next) => {
    const requestId = ensureRequestId(req);
    const key = getKey(req);
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || now > existing.resetAt) {
        const resetAt = now + RATE_LIMIT_WINDOW_MS;
        buckets.set(key, { count: 1, resetAt });
        console.log(`${LOG_PREFIX} ${requestId} rate-limit reset`, {
            key,
            count: 1,
            remaining: Math.max(0, RATE_LIMIT_MAX - 1),
            windowMs: RATE_LIMIT_WINDOW_MS
        });
        return next();
    }

    if (existing.count >= RATE_LIMIT_MAX) {
        console.warn(`${LOG_PREFIX} ${requestId} rate-limit blocked`, {
            key,
            count: existing.count,
            resetInMs: Math.max(0, existing.resetAt - now),
            windowMs: RATE_LIMIT_WINDOW_MS
        });
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }

    existing.count += 1;
    buckets.set(key, existing);
    console.log(`${LOG_PREFIX} ${requestId} rate-limit ok`, {
        key,
        count: existing.count,
        remaining: Math.max(0, RATE_LIMIT_MAX - existing.count)
    });
    return next();
};

module.exports = { chatRateLimit };
