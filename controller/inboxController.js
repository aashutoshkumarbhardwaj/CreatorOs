const InboxMessage = require("../model/inboxMessage");

exports.getInbox = async (req, res) => {

    let messages = await InboxMessage.find().sort({
        createdAt: -1
    });

    res.render("inbox", {
        messages
    });

};