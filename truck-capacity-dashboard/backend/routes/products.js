const express = require('express');
const router = express.Router();
const multer = require('multer');
const Product = require('../models/Product');
const SyncConfig = require('../models/SyncConfig');
const {
  parseAndUpsertProducts,
  syncFromGoogleSheet,
  getSyncStatus
} = require('../services/productSyncService');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { count } = await parseAndUpsertProducts(req.file.buffer);
    res.status(200).json({ message: `Successfully updated CBM for ${count} products.` });
  } catch (error) {
    console.error('[Upload Error]:', error);
    res.status(500).json({ message: error.message || 'Server error processing file' });
  }
});


router.get('/sync-status', async (req, res) => {
  try {
    const status = await getSyncStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error('[Sync Status Error]:', error);
    res.status(500).json({ message: 'Error retrieving sync status' });
  }
});


router.post('/sheet-config', async (req, res) => {
  try {
    const { googleSheetUrl, autoSyncEnabled, cronSchedule } = req.body;
    let config = await SyncConfig.findOne({ key: 'googleSheetSync' });
    if (!config) {
      config = new SyncConfig({ key: 'googleSheetSync' });
    }

    if (googleSheetUrl !== undefined) config.googleSheetUrl = googleSheetUrl.trim();
    if (autoSyncEnabled !== undefined) config.autoSyncEnabled = Boolean(autoSyncEnabled);
    if (cronSchedule !== undefined && cronSchedule.trim()) config.cronSchedule = cronSchedule.trim();

    await config.save();
    res.status(200).json({ message: 'Configuration saved successfully', config });
  } catch (error) {
    console.error('[Save Config Error]:', error);
    res.status(500).json({ message: 'Error saving sheet configuration' });
  }
});


router.post('/sync-sheet', async (req, res) => {
  try {
    const { sheetUrl } = req.body;
    const result = await syncFromGoogleSheet(sheetUrl);
    res.status(200).json(result);
  } catch (error) {
    console.error('[Sync Trigger Error]:', error);
    res.status(500).json({
      message: error.message || 'Error synchronizing products from Google Sheets',
      details: error.toString()
    });
  }
});


router.get('/', async (req, res) => {
  try {
    const products = await Product.find({});
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching products' });
  }
});


router.delete('/all', async (req, res) => {
  try {
    await Product.deleteMany({});
    res.status(200).json({ message: 'All master data cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error deleting products' });
  }
});

module.exports = router;
