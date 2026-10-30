const cron = require('node-cron');
const SyncConfig = require('../models/SyncConfig');
const { syncFromGoogleSheet } = require('../services/productSyncService');
const { syncOrdersFromGoogleSheet } = require('../services/orderSyncService');

let scheduledJobs = [];

const stopAllJobs = () => {
  scheduledJobs.forEach(job => job.stop());
  scheduledJobs = [];
};

const initScheduler = async () => {
  try {
    stopAllJobs();

    // Check product sync config
    let productConfig = await SyncConfig.findOne({ key: 'googleSheetSync' });
    if (!productConfig) {
      productConfig = await SyncConfig.create({
        key: 'googleSheetSync',
        googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
        cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 6 * * *',
        autoSyncEnabled: true
      });
    }

    // Check orders sync config
    let orderConfig = await SyncConfig.findOne({ key: 'ordersSheetSync' });
    if (!orderConfig) {
      orderConfig = await SyncConfig.create({
        key: 'ordersSheetSync',
        googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
        cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 6 * * *',
        autoSyncEnabled: true
      });
    }

    const schedule = productConfig.cronSchedule || process.env.SYNC_CRON_SCHEDULE || '0 6 * * *';

    if (cron.validate(schedule)) {
      console.log(`[Scheduler] Initializing automated sync with schedule: "${schedule}"`);

      const job = cron.schedule(schedule, async () => {
        console.log('[Scheduler] Running scheduled synchronization...');
        try {
          const freshProdConfig = await SyncConfig.findOne({ key: 'googleSheetSync' });
          if (freshProdConfig && freshProdConfig.autoSyncEnabled !== false) {
            console.log('[Scheduler] Syncing products from Google Sheet...');
            await syncFromGoogleSheet();
          }

          const freshOrderConfig = await SyncConfig.findOne({ key: 'ordersSheetSync' });
          if (freshOrderConfig && freshOrderConfig.autoSyncEnabled !== false) {
            console.log('[Scheduler] Syncing orders from Google Sheet...');
            await syncOrdersFromGoogleSheet();
          }
        } catch (err) {
          console.error('[Scheduler] Error during scheduled sync:', err.message);
        }
      });

      scheduledJobs.push(job);
      console.log('[Scheduler] Cron job registered successfully.');
    } else {
      console.warn(`[Scheduler] Invalid cron schedule format: "${schedule}". Scheduler paused.`);
    }
  } catch (error) {
    console.error('[Scheduler] Failed to initialize scheduler:', error.message);
  }
};

module.exports = {
  initScheduler,
  stopAllJobs
};
