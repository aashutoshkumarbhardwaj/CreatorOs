const express = require('express');
const router = express.Router();

const {
    renderPage,
    listItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem,
    convertItem,
    generateAiSuggestions,
    listFolders,
    createFolder,
    deleteFolder,
    exportToIntegration,
} = require('../controller/contentOsController');

const {
    contentOsItemValidator,
    contentOsFolderValidator,
    contentOsAiValidator,
} = require('../middleware/validators');

const { aiGenerationLimiter } = require('../middleware/rateLimiters');

/**
 * @swagger
 * /services/content-os:
 *   get:
 *     summary: Render Content OS main workspace
 */
router.get('/', renderPage);

// API Endpoints for Content OS Items
router.get('/api/items', listItems);
router.post('/api/items', contentOsItemValidator, createItem);
router.get('/api/items/:id', getItemById);
router.put('/api/items/:id', updateItem);
router.delete('/api/items/:id', deleteItem);
router.post('/api/items/:id/convert', convertItem);

// AI Suggestions & Content Brainstorming
router.post('/api/ai/generate', aiGenerationLimiter, contentOsAiValidator, generateAiSuggestions);

// Folders Management
router.get('/api/folders', listFolders);
router.post('/api/folders', contentOsFolderValidator, createFolder);
router.delete('/api/folders/:id', deleteFolder);

// External Integrations Sync
router.post('/api/integrations/export', exportToIntegration);

module.exports = router;
