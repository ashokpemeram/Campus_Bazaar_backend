const collegeDomains = require('../config/collegeDomains');

const normalizeEmail = (email) => (email || '').toString().trim().toLowerCase();

const getEmailDomain = (email) => {
    const normalized = normalizeEmail(email);
    const parts = normalized.split('@');
    if (parts.length !== 2 || !parts[1]) return '';
    return parts[1];
};

const isAllowedCollegeEmail = (email) => {
    const domain = getEmailDomain(email);
    if (!domain) return false;
    return Object.prototype.hasOwnProperty.call(collegeDomains, domain);
};

const allowedDomains = Object.keys(collegeDomains);

module.exports = { allowedDomains, normalizeEmail, getEmailDomain, isAllowedCollegeEmail };
