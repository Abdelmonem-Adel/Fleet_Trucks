const mongoose = require('mongoose');

const syncConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    googleSheetUrl: {
      type: String,
      default: '',
      trim: true
    },
    cronSchedule: {
      type: String,
      default: '0 6 * * *',
      trim: true
    },
    autoSyncEnabled: {
      type: Boolean,
      default: true
    },
    lastSyncAt: {
      type: Date,
      default: null
    },
    lastSyncStatus: {
      type: String,
      enum: ['idle', 'running', 'success', 'error'],
      default: 'idle'
    },
    lastSyncMessage: {
      type: String,
      default: ''
    },
    productsUpdatedCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SyncConfig', syncConfigSchema);
