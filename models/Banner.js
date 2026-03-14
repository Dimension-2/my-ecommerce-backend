const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    imageURL: String,
    title: String,
    subtitle: String
});

module.exports = mongoose.model('Banner', bannerSchema);