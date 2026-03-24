const collegeDomains = require('../config/collegeDomains');
const CollegeDomain = require('../models/CollegeDomain');

const formatCollegeName = (domain) => {
    return (domain || '')
        .split('.')[0]
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeCollegeName = (name) => {
    return (name || '').toString().trim().replace(/\s+/g, ' ');
};

const resolveCollegeName = async (domain) => {
    const normalizedDomain = (domain || '').toLowerCase().trim();
    if (!normalizedDomain) {
        return { collegeName: '', isFallback: true, source: 'none' };
    }

    const hasDomain = Object.prototype.hasOwnProperty.call(collegeDomains, normalizedDomain);
    if (hasDomain && collegeDomains[normalizedDomain]) {
        return { collegeName: collegeDomains[normalizedDomain], isFallback: false, source: 'static' };
    }

    const stored = await CollegeDomain.findOne({ domain: normalizedDomain }).lean();
    if (stored?.collegeName) {
        return { collegeName: stored.collegeName, isFallback: false, source: 'db' };
    }

    return { collegeName: formatCollegeName(normalizedDomain), isFallback: true, source: 'fallback' };
};

const upsertCollegeDomain = async (domain, collegeName) => {
    const normalizedDomain = (domain || '').toLowerCase().trim();
    const normalizedName = normalizeCollegeName(collegeName);
    if (!normalizedDomain || !normalizedName) return;

    await CollegeDomain.updateOne(
        { domain: normalizedDomain },
        { $set: { collegeName: normalizedName } },
        { upsert: true }
    );
};

module.exports = { formatCollegeName, normalizeCollegeName, resolveCollegeName, upsertCollegeDomain };
