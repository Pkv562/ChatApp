const mongoose = require('mongoose');

const UserScheme = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
}, {timestamps: true});

const UserModel = mongoose.model('User', UserScheme);
module.exports = UserModel;
