const mongoose = require('mongoose');

const collegeDomainSchema = new mongoose.Schema({
    domain: { type: String, required: true, unique: true },
    collegeName: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('CollegeDomain', collegeDomainSchema);
