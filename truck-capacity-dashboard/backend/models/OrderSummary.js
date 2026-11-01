const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '' },
    productName: { type: String, default: '' },
    category: { type: String, default: '' },
    qty: { type: Number, default: 0 },
    cbm: { type: Number, default: 0 },
    unitCbm: { type: Number, default: 0 }
  },
  { _id: false }
);

const orderSummarySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
    branchName: {
      type: String,
      required: true,
      trim: true
    },
    zone: {
      type: String,
      default: 'General Zone'
    },
    totalQty: {
      type: Number,
      default: 0
    },
    totalCbm: {
      type: Number,
      default: 0
    },
    items: [orderItemSchema],
    recommendedTrucks: {
      jumbo4m: { type: Number, default: 0 },
      jumbo: { type: Number, default: 0 },
      NKR: { type: Number, default: 0 },
      dabbaba: { type: Number, default: 0 }
    },
    actualTrucks: {
      type: mongoose.Schema.Types.Mixed,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

orderSummarySchema.index({ date: 1, branchName: 1 });

module.exports = mongoose.model('OrderSummary', orderSummarySchema);
