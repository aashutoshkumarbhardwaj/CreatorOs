const mongoose = require("mongoose");

const inboxMessageSchema = new mongoose.Schema(
{
    channel: {
        type: String,
        enum: ["Email", "Instagram", "SMS", "X"],
        required: true
    },

    sender: {
        type: String,
        required: true
    },

    subject: String,

    body: String,

    priority: {
        type: String,
        default: "Normal"
    },

    read: {
        type: Boolean,
        default: false
    },

    important: {
        type: Boolean,
        default: false
    },

    archived: {
        type: Boolean,
        default: false
    }

},
{
    timestamps: true
});

module.exports = mongoose.model("InboxMessage", inboxMessageSchema);