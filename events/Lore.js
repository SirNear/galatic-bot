const mongoose = require('mongoose');

const PageSchema = new mongoose.Schema({
    content: { type: String, required: true },
    imageUrl: { type: String, required: false },
});

const ChapterSchema = new mongoose.Schema({
    name: { type: String, required: true }, // Ex: "Capítulo 1: O Início"
    pages: [PageSchema],
});

const LoreSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    createdBy: { type: String, required: true },
    title: { type: String, required: true },
    chapters: [ChapterSchema],
}, {
    timestamps: true
});

const Lore = mongoose.model('Lore', LoreSchema);

module.exports = Lore;