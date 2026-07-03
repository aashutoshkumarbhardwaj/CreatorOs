const express = require('express');
const {
    createOrUpdateContent,
    getContent,
    listContent,
    deleteContent,
    getScheduledContent,
} = require('../controller/contentController');

const router = express.Router();

router.post('/', createOrUpdateContent);
router.get('/', listContent);
router.get('/scheduled', getScheduledContent);
router.get('/:id', getContent);
router.delete('/:id', deleteContent);

module.exports = router;
