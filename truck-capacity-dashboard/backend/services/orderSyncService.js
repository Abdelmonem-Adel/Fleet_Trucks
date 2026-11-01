const path = require('path');
const fs = require('fs');
const axios = require('axios');
const xlsx = require('xlsx');
const { google } = require('googleapis');
const OrderSummary = require('../models/OrderSummary');
const Product = require('../models/Product');
const SyncConfig = require('../models/SyncConfig');
const { calculateTrucks, getConsolidationSuggestions } = require('../utils/truckCalculator');
const { findServiceAccountKeyPath, extractSpreadsheetId, syncFromGoogleSheet } = require('./productSyncService');

const cleanStr = (val) => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.endsWith('.0')) str = str.slice(0, -2);
  return str;
};

const cleanKey = (k) => String(k || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');

const getVal = (rowObj, candidates) => {
  if (!rowObj || typeof rowObj !== 'object') return undefined;
  for (const c of candidates) {
    if (rowObj[c] !== undefined && rowObj[c] !== null && rowObj[c] !== '') return rowObj[c];
  }
  const normCandidates = candidates.map(cleanKey);
  const rowKeys = Object.keys(rowObj);
  for (let i = 0; i < candidates.length; i++) {
    const targetNorm = normCandidates[i];
    const matchKey = rowKeys.find(k => cleanKey(k) === targetNorm);
    if (matchKey && rowObj[matchKey] !== undefined && rowObj[matchKey] !== null && rowObj[matchKey] !== '') {
      return rowObj[matchKey];
    }
  }
  return undefined;
};

const parseNum = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(',', '.');
  const direct = parseFloat(str);
  if (!isNaN(direct)) return direct;
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? (parseFloat(match[0]) || 0) : 0;
};

const parseDateVal = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    try {
      const parsed = xlsx.SSF.parse_date_code(val);
      if (parsed) {
        return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0)));
      }
    } catch (e) {}
  }
  const str = String(val).trim();
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  
  const parts = str.split(/[/ -]/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (year > 2000 && month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return new Date(year, month, day);
    }
  }
  return null;
};

const formatBranchName = (raw) => {
  if (!raw) return 'Unknown';
  let str = String(raw).trim();
  const parts = str.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (!['stock', 'output', 'input', 'transit', 'vendors', 'customers', 'scrap', 'inter-company'].includes(last.toLowerCase())) {
      return last;
    }
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
  }
  return str;
};

const guessZone = (branchName, rawLocation = '') => {
  const name = String(branchName).trim();

  const baseZone = name
    .replace(/\s*FP\s*#?\s*\d+\s*$/i, '')  
    .replace(/\s*(#\d+|\d+)\s*$/i, '')     
    .replace(/^OUT\s+/i, '')                
    .trim();

  
  if (baseZone && baseZone.length > 2) {
    return baseZone;
  }

  
  const combined = (name + ' ' + String(rawLocation)).toLowerCase();
  if (combined.includes('october') || combined.includes('zayed') || combined.includes('haram') || combined.includes('faisal') || combined.includes('giza') || combined.includes('dokki') || combined.includes('mohandessin')) {
    return 'Giza / 6th of October';
  }
  if (combined.includes('maadi') || combined.includes('mokattam') || combined.includes('helwan') || combined.includes('basateen')) {
    return 'South Cairo';
  }
  if (combined.includes('nasr') || combined.includes('heliopolis') || combined.includes('sheraton') || combined.includes('nozha') || combined.includes('obour') || combined.includes('shorouk')) {
    return 'East Cairo';
  }
  if (combined.includes('tagamoa') || combined.includes('rehab') || combined.includes('madinaty') || combined.includes('mostakbal') || combined.includes('new cairo')) {
    return 'New Cairo';
  }
  if (combined.includes('alex') || combined.includes('agami') || combined.includes('smouha')) {
    return 'Alexandria';
  }
  return 'General Zone';
};


async function processOrderRows(data) {
  if (!data || data.length === 0) {
    throw new Error('No valid data rows found in Orders sheet');
  }

  let products = await Product.find({}, { productId: 1, name: 1, category: 1, cbm: 1 }).lean();
  if (products.length === 0) {
    console.log('[OrderSync] No products found in DB. Auto-syncing products from Google Sheet (Data + Single Items)...');
    try {
      await syncFromGoogleSheet();
      products = await Product.find({}, { productId: 1, name: 1, category: 1, cbm: 1 }).lean();
    } catch (e) {
      console.warn('[OrderSync] Auto product sync attempt:', e.message);
    }
  }
  const productMapById = {};
  const productMapByName = {};

  products.forEach(p => {
    if (p.productId) {
      const cleanId = cleanStr(p.productId).toLowerCase();
      if (cleanId) {
        if (!productMapById[cleanId] || (p.cbm > 0 && !productMapById[cleanId].cbm)) {
          productMapById[cleanId] = p;
        }
      }
    }
    if (p.name) {
      const cleanName = cleanStr(p.name).toLowerCase();
      if (cleanName) {
        if (!productMapByName[cleanName] || (p.cbm > 0 && !productMapByName[cleanName].cbm)) {
          productMapByName[cleanName] = p;
        }
      }
    }
  });

  const branchTotals = {};
  const missingProducts = new Set();
  let detectedTransferDate = null;

  data.forEach(row => {
    const status = String(getVal(row, ['Stock move/Status', 'Status', 'الحالة']) || '').toLowerCase();
    if (['cancel', 'cancelled', 'ملغي', 'ملغى'].includes(status)) {
      return;
    }

    if (!detectedTransferDate) {
      const rawDate = getVal(row, ['Date of Transfer', 'Transfer Date', 'Date', 'التاريخ']);
      if (rawDate) {
        detectedTransferDate = parseDateVal(rawDate);
      }
    }

    const rawLocation = cleanStr(getVal(row, [
      'Stock move/Destination Location',
      'Destination Location',
      'FP',
      'Branch',
      'الفرع',
      'الموقع',
      'موقع الوجهة'
    ]));

    const branchName = formatBranchName(rawLocation);
    if (!branchName || branchName.toLowerCase() === 'unknown') {
      if (!rawLocation) return;
    }

    const effectiveBranch = branchName !== 'Unknown' ? branchName : rawLocation;

    let rawId = getVal(row, [
      'Stock move/Product/Internal Reference',
      'Stock move/Product/Internal_Reference',
      'Internal Reference',
      'Default Code',
      'Product ID',
      'Product/ID',
      'Product Code',
      'Item ID',
      'ID',
      'كود المنتج',
      'كود الصنف',
      'كود',
      'SKU'
    ]);

    let rawBarcode = getVal(row, [
      'Stock move/Product/Barcode',
      'Barcode',
      'باركود'
    ]);

    let rawName = getVal(row, [
      'Stock move/Product/Name',
      'Stock move/Product',
      'Product Name',
      'Product',
      'الصنف',
      'اسم الصنف',
      'Item',
      'المنتج',
      'Display Name'
    ]);

    let productId = cleanStr(rawId || rawBarcode);
    let barcode = cleanStr(rawBarcode);
    let productName = cleanStr(rawName);

    if (!productId && productName) {
      const bracketMatch = productName.match(/^\[(.*?)\]\s*(.*)$/);
      if (bracketMatch) {
        productId = cleanStr(bracketMatch[1]);
        productName = cleanStr(bracketMatch[2]) || productName;
      }
    }

    const demand = parseNum(getVal(row, [
      'Stock move/Demand',
      'Demand',
      'الطلب',
      'الكمية المطلوبة'
    ]));

    const doneQty = parseNum(getVal(row, [
      'Stock move/Quantity',
      'Quantity',
      'QTY',
      'Qty',
      'الكمية',
      'الكمية المحققة',
      'الكمية الفعلية'
    ]));

    const qty = demand > 0 ? demand : (doneQty > 0 ? doneQty : 0);

    let directCbm = parseNum(getVal(row, [
      'CBM', 'cbm', 'Total CBM', 'Volume', 'Volume (m³)', 'Volume (m3)', 'الحجم'
    ]));

    let matchedProduct = null;
    if (productId) {
      matchedProduct = productMapById[productId.toLowerCase()];
    }
    if (!matchedProduct && barcode) {
      matchedProduct = productMapById[barcode.toLowerCase()];
    }
    if (!matchedProduct && productName) {
      matchedProduct = productMapByName[productName.toLowerCase()];
    }

    let unitCbm = 0;
    let calculatedCbm = 0;

    if (matchedProduct && matchedProduct.cbm > 0) {
      unitCbm = matchedProduct.cbm;
      calculatedCbm = unitCbm * qty;
    } else if (directCbm > 0) {
      if (directCbm > 100) {
        directCbm = directCbm / 1000000;
      }
      calculatedCbm = directCbm;
      unitCbm = qty > 0 ? directCbm / qty : directCbm;
    } else if (productName || productId) {
      missingProducts.add(productId ? `${productId} - ${productName}` : productName);
      calculatedCbm = 0;
    }

    const customZone = cleanStr(getVal(row, ['Zone', 'المنطقة']));
    const zone = customZone || guessZone(effectiveBranch, rawLocation);

    if (!branchTotals[effectiveBranch]) {
      branchTotals[effectiveBranch] = { 
        qty: 0, 
        cbm: 0, 
        zone,
        itemsMap: {}
      };
    }

    const itemKey = (productId || barcode || productName || `Item_${Object.keys(branchTotals[effectiveBranch].itemsMap).length + 1}`).toLowerCase();
    
    if (!branchTotals[effectiveBranch].itemsMap[itemKey]) {
      branchTotals[effectiveBranch].itemsMap[itemKey] = {
        productId: productId || (matchedProduct ? matchedProduct.productId : ''),
        productName: productName || (matchedProduct ? matchedProduct.name : ''),
        category: matchedProduct?.category || '',
        qty: 0,
        cbm: 0,
        unitCbm: unitCbm
      };
    }

    if (!branchTotals[effectiveBranch].itemsMap[itemKey].unitCbm && unitCbm > 0) {
      branchTotals[effectiveBranch].itemsMap[itemKey].unitCbm = unitCbm;
    }

    branchTotals[effectiveBranch].itemsMap[itemKey].qty += qty;
    branchTotals[effectiveBranch].itemsMap[itemKey].cbm += calculatedCbm;
    branchTotals[effectiveBranch].qty += qty;
    branchTotals[effectiveBranch].cbm += calculatedCbm;
  });

  const newOrders = [];
  const orderDate = detectedTransferDate || new Date();

  for (const [branchName, totals] of Object.entries(branchTotals)) {
    if (totals.cbm > 0 || totals.qty > 0) {
      const recommendedTrucks = calculateTrucks(totals.cbm, branchName);
      const items = Object.values(totals.itemsMap);
      
      const order = new OrderSummary({
        date: orderDate,
        branchName,
        zone: totals.zone,
        totalQty: totals.qty,
        totalCbm: totals.cbm,
        items,
        recommendedTrucks
      });
      
      newOrders.push(order);
    }
  }

  const startOfDay = new Date(orderDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(orderDate);
  endOfDay.setHours(23, 59, 59, 999);

  await OrderSummary.deleteMany({
    date: { $gte: startOfDay, $lte: endOfDay }
  });

  if (newOrders.length > 0) {
    await OrderSummary.insertMany(newOrders);
  }
  
  const alerts = getConsolidationSuggestions(newOrders);
  const missingArr = Array.from(missingProducts);

  return {
    orders: newOrders,
    alerts,
    missingProducts: missingArr,
    orderDate,
    totalRows: data.length
  };
}


async function fetchOrdersViaServiceAccount(spreadsheetId, keyFilePath) {
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });


  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];
  if (sheetList.length === 0) {
    throw new Error('The Google Spreadsheet has no sheets');
  }

  const ordersSheet = sheetList.find(s => s.properties.title.trim().toLowerCase() === 'orders');
  const sheetTitle = ordersSheet ? ordersSheet.properties.title : 'Orders';

  console.log(`[OrderSync] Fetching tab "${sheetTitle}" from spreadsheet ${spreadsheetId}`);


  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:ZZ`,
    valueRenderOption: 'UNFORMATTED_VALUE'
  });

  const values = response.data.values;
  if (!values || values.length === 0) {
    throw new Error(`Sheet tab "${sheetTitle}" is empty or has no data`);
  }

  // Find header row (default to 0, or find row containing stock move / destination / branch / etc.)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const rowStr = values[i].map(c => String(c).toLowerCase()).join(' ');
    if (
      rowStr.includes('stock move') || 
      rowStr.includes('destination') || 
      rowStr.includes('internal reference') || 
      rowStr.includes('demand') || 
      rowStr.includes('product') || 
      rowStr.includes('branch') ||
      rowStr.includes('الفرع') ||
      rowStr.includes('الكمية')
    ) {
      headerIndex = i;
      break;
    }
  }

  const headers = values[headerIndex];
  const rowObjects = values.slice(headerIndex + 1).map(row => {
    const obj = {};
    headers.forEach((header, idx) => {
      if (header !== undefined && header !== null && String(header).trim() !== '') {
        obj[String(header).trim()] = row[idx];
      }
    });
    return obj;
  });

  return rowObjects;
}


async function fetchOrdersViaExportLink(spreadsheetId) {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const response = await axios.get(exportUrl, {
    responseType: 'arraybuffer',
    timeout: 45000,
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const workbook = xlsx.read(Buffer.from(response.data), { type: 'buffer' });
  const sheetNames = workbook.SheetNames || [];
  const targetSheetName = sheetNames.find(s => s.trim().toLowerCase() === 'orders') || sheetNames[0];

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error(`Could not find "Orders" tab in downloaded workbook. Available tabs: ${sheetNames.join(', ')}`);
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows || rows.length === 0) return [];
  
  let headerIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
    if (
      rowStr.includes('stock move') || 
      rowStr.includes('destination') || 
      rowStr.includes('internal reference') || 
      rowStr.includes('demand') || 
      rowStr.includes('product') || 
      rowStr.includes('branch') ||
      rowStr.includes('الفرع') ||
      rowStr.includes('الكمية')
    ) {
      headerIndex = i;
      break;
    }
  }

  return xlsx.utils.sheet_to_json(sheet, { range: headerIndex });
}



async function syncOrdersFromGoogleSheet(sheetUrlOverride = null) {
  let config = await SyncConfig.findOne({ key: 'ordersSheetSync' });
  if (!config) {
    config = new SyncConfig({
      key: 'ordersSheetSync',
      googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
      cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 6 * * *'
    });
    await config.save();
  }

  // Get source URL from override, env, or config
  const productConfig = await SyncConfig.findOne({ key: 'googleSheetSync' });
  const configuredSource = sheetUrlOverride || process.env.GOOGLE_SHEET_URL || productConfig?.googleSheetUrl || config.googleSheetUrl;
  const spreadsheetId = extractSpreadsheetId(configuredSource);

  if (!spreadsheetId) {
    const err = 'Google Sheet link or ID not configured in backend/.env file (GOOGLE_SHEET_URL)';
    config.lastSyncStatus = 'error';
    config.lastSyncMessage = err;
    await config.save();
    throw new Error(err);
  }

  config.lastSyncStatus = 'running';
  await config.save();

  try {
    let rowObjects = null;
    const serviceAccountKeyPath = findServiceAccountKeyPath();

    if (serviceAccountKeyPath) {
      try {
        rowObjects = await fetchOrdersViaServiceAccount(spreadsheetId, serviceAccountKeyPath);
      } catch (saError) {
        console.warn(`[OrderSync] Service Account error (${saError.message}). Attempting export fallback...`);
        try {
          rowObjects = await fetchOrdersViaExportLink(spreadsheetId);
        } catch (exportError) {
          if (saError.message && saError.message.includes('invalid_grant')) {
            throw new Error(
              'Google Auth failed with "invalid_grant" (System clock out of sync). Please synchronize your computer\'s date and time in Windows Settings.'
            );
          }
          throw saError;
        }
      }
    } else {
      console.log('[OrderSync] No service account key found, falling back to export link...');
      rowObjects = await fetchOrdersViaExportLink(spreadsheetId);
    }

    const result = await processOrderRows(rowObjects);

    config.lastSyncAt = new Date();
    config.lastSyncStatus = 'success';
    config.productsUpdatedCount = result.orders.length; // number of branch orders
    config.lastSyncMessage = `Successfully synced orders for ${result.orders.length} branches (${result.totalRows} sheet rows).`;
    await config.save();

    console.log(`[OrderSync] Success: ${config.lastSyncMessage}`);

    return {
      success: true,
      message: config.lastSyncMessage,
      orders: result.orders,
      alerts: result.alerts,
      missingProducts: result.missingProducts,
      orderDate: result.orderDate,
      lastSyncAt: config.lastSyncAt
    };
  } catch (error) {
    console.error('[OrderSync] Error:', error.message);
    config.lastSyncAt = new Date();
    config.lastSyncStatus = 'error';
    config.lastSyncMessage = error.message;
    await config.save();
    throw error;
  }
}

/**
 * Gets current orders sync status
 */
async function getOrderSyncStatus() {
  let config = await SyncConfig.findOne({ key: 'ordersSheetSync' });
  if (!config) {
    config = await SyncConfig.create({
      key: 'ordersSheetSync',
      googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
      cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 6 * * *'
    });
  }

  const latestOrder = await OrderSummary.findOne().sort({ date: -1 });

  return {
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastSyncMessage: config.lastSyncMessage,
    branchCount: config.productsUpdatedCount || 0,
    latestOrderDate: latestOrder?.date || null
  };
}

module.exports = {
  processOrderRows,
  syncOrdersFromGoogleSheet,
  getOrderSyncStatus
};
