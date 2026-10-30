const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    weight: {
      type: Number,
      default: 0
    },
    depth: {
      type: Number,
      default: 0
    },
    width: {
      type: Number,
      default: 0
    },
    height: {
      type: Number,
      default: 0
    },
    piecesPerCarton: {
      type: Number,
      default: 0
    },
    cartonsPerPallet: {
      type: Number,
      default: 0
    },
    category: {
      type: String,
      default: '',
      trim: true
    },
    cartonCbm: {
      type: Number,
      default: 0
    },
    cbm: {
      type: Number,
      default: 0
    },
    destinationLocation: {
      type: String,
      default: '',
      trim: true
    },
    branchName: {
      type: String,
      default: '',
      trim: true
    },
    sourceTab: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Product', productSchema);
