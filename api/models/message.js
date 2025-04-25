const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    recipient: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    text: String,
}, {timestamps: true});

// Create and export the Message model
const Message = mongoose.model('Message', messageSchema);
module.exports = Message;