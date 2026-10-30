const path = require('path');
const fs = require('fs');
const axios = require('axios');
const xlsx = require('xlsx');
const { google } = require('googleapis');
const Product = require('../models/Product');
const SyncConfig = require('../models/SyncConfig');

/**
 * Searches for a Service Account credentials JSON file in known paths
 */
function findServiceAccountKeyPath() {
  const customPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  const candidatePaths = [
    customPath ? path.resolve(process.cwd(), customPath) : null,
    path.resolve(__dirname, '../service-account.json'),
    path.resolve(__dirname, '../credentials.json'),
    path.resolve(__dirname, '../config/service-account.json'),
    path.resolve(__dirname, '../config/credentials.json')
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Extracts the spreadsheet ID from a URL or raw ID
 */
function extractSpreadsheetId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return '';
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Cleans string values
 */
function cleanStr(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.endsWith('.0')) str = str.slice(0, -2);
  return str;
}

/**
 * Parses numeric values safely
 */
function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(',', '.');
  const direct = parseFloat(str);
  if (!isNaN(direct)) return direct;
  const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? (parseFloat(match[0]) || 0) : 0;
}

/**
 * Normalizes string keys for flexible column matching
 */
const cleanKey = (k) => String(k || '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');

/**
 * Gets value from row matching possible column keys
 */
function getVal(rowObj, possibleKeys) {
  if (!rowObj || typeof rowObj !== 'object') return undefined;
  for (const key of possibleKeys) {
    if (rowObj[key] !== undefined && rowObj[key] !== null && rowObj[key] !== '') {
      return rowObj[key];
    }
  }
  const normCandidates = possibleKeys.map(cleanKey);
  const rowKeys = Object.keys(rowObj);
  for (let i = 0; i < possibleKeys.length; i++) {
    const targetNorm = normCandidates[i];
    const matchKey = rowKeys.find(k => cleanKey(k) === targetNorm);
    if (matchKey && rowObj[matchKey] !== undefined && rowObj[matchKey] !== null && rowObj[matchKey] !== '') {
      return rowObj[matchKey];
    }
  }
  return undefined;
}

/**
 * Converts Google Sheets API values 2D array to array of row objects
 */
function sheetValuesToObjects(values) {
  if (!values || values.length === 0) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.length === 0) continue;
    const obj = {};
    let hasVal = false;
    headers.forEach((header, idx) => {
      if (header !== undefined && header !== null && String(header).trim() !== '') {
        const val = row[idx];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          hasVal = true;
        }
        obj[String(header).trim()] = val;
      }
    });
    if (hasVal) {
      rows.push(obj);
    }
  }
  return rows;
}

/**
 * Helper to extract cleaned product ID from row
 */
function extractRowProductId(row) {
  const rawId = getVal(row, [
    'ID', 'Stock move/Product/Internal Reference', 'Stock move/Product/Internal_Reference',
    'Product ID', 'Product/ID', 'Product Code', 'Item ID', 'كود المنتج', 'كود الصنف', 'كود',
    'Internal Reference', 'Default Code', 'SKU', 'Barcode', 'Item Code', 'Code'
  ]);
  let productId = cleanStr(rawId);
  if (!productId) {
    const rawName = getVal(row, [
      'Name', 'Stock move/Product/Name', 'Stock move/Product', 'Product',
      'المنتج', 'الصنف', 'Product Name', 'اسم الصنف', 'Display Name'
    ]);
    const name = cleanStr(rawName);
    if (name) {
      const bracketMatch = name.match(/^\[(.*?)\]\s*(.*)$/);
      if (bracketMatch) {
        productId = cleanStr(bracketMatch[1]);
      }
    }
  }
  return productId;
}

/**
 * Merges rows from 'Data' and 'Single Items' tabs without removing duplicate IDs
 */
function mergeDataAndSingleItems(dataRows, singleItemsRows) {
  const mergedRows = [];

  (dataRows || []).forEach(row => {
    mergedRows.push({ ...row, _sourceTab: 'Data' });
  });

  (singleItemsRows || []).forEach(row => {
    mergedRows.push({ ...row, _sourceTab: 'Single Items' });
  });

  console.log(`[GoogleSheetSync] Sheet Merge: ${dataRows ? dataRows.length : 0} from Data, ${singleItemsRows ? singleItemsRows.length : 0} from Single Items (All duplicate IDs preserved). Total: ${mergedRows.length}`);
  return mergedRows;
}

/**
 * Normalizes rows and inserts all products into Product collection in chunks without removing duplicates
 */
async function processRowObjects(data) {
  if (!data || data.length === 0) {
    throw new Error('No product rows found in data');
  }

  // Clear previous product snapshot so duplicates from the new sync are cleanly stored
  await Product.deleteMany({});

  let count = 0;
  const bulkOps = [];

  for (const row of data) {
    const keys = Object.keys(row);

    let productId = extractRowProductId(row);

    let name = getVal(row, [
      'Name', 'Stock move/Product/Name', 'Stock move/Product', 'Product',
      'المنتج', 'الصنف', 'Product Name', 'اسم الصنف', 'Display Name'
    ]) || (keys.length > 0 ? row[keys[0]] : '');

    productId = cleanStr(productId);
    name = cleanStr(name);

    if (!productId && name) {
      const bracketMatch = name.match(/^\[(.*?)\]\s*(.*)$/);
      if (bracketMatch) {
        productId = cleanStr(bracketMatch[1]);
        name = cleanStr(bracketMatch[2]) || name;
      }
    }

    const depth = parseNum(getVal(row, ['dimension_depth_cm', 'dimension_depth', 'depth_cm', 'depth', 'Depth_cm', 'Depth', 'Length', 'طول', 'الطول', 'عمق']));
    const width = parseNum(getVal(row, ['dimension_width_cm', 'dimension_width', 'width_cm', 'width', 'Width_cm', 'Width', 'عرض', 'العرض']));
    const height = parseNum(getVal(row, ['dimension_height_cm', 'dimension_height', 'height_cm', 'height', 'Height_cm', 'Height', 'ارتفاع', 'الارتفاع']));
    const weight = parseNum(getVal(row, ['Weight', 'weight', 'weight_kg', 'Wight', 'wight', 'الوزن', 'وزن']));
    const piecesPerCarton = parseNum(getVal(row, ['pieces/cartons', 'pieces_cartons', 'pieces/carton', 'Pieces Per Carton', 'pieces per carton', 'عدد القطع بالكرتونة', 'قطع/كرتونة']));
    const cartonsPerPallet = parseNum(getVal(row, ['cartons/pallets', 'cartons_pallets', 'cartons/pallet', 'Cartons Per Pallet', 'cartons per pallet', 'عدد الكراتين بالبالتة', 'كرتونة/بالتة']));
    const category = getVal(row, ['Product/Financial Category', 'Category', 'الفئة', 'فئة']) || '';

    // Check direct unit CBM first (e.g. "CBM per Unit" in sheet)
    const directUnitCbm = parseNum(getVal(row, ['CBM per Unit', 'Unit CBM', 'CBM/Unit', 'cbm per unit', 'Unit Cbm']));
    let cartonCbm = parseNum(
      getVal(row, ['Carton CBM', 'CBM', 'cbm', 'Volume', 'Volume (m³)', 'Volume (m3)', 'Total CBM', 'الحجم', 'حجم'])
    );

    let unitPieceCbm = 0;

    if (directUnitCbm > 0) {
      unitPieceCbm = directUnitCbm;
      if (cartonCbm <= 0) {
        cartonCbm = piecesPerCarton > 0 ? directUnitCbm * piecesPerCarton : directUnitCbm;
      }
    } else if (cartonCbm > 0) {
      if (cartonCbm > 5) {
        cartonCbm = cartonCbm > 1000 ? cartonCbm / 1000000 : cartonCbm / 1000;
      }
      unitPieceCbm = piecesPerCarton > 0 ? cartonCbm / piecesPerCarton : cartonCbm;
    } else if (depth > 0 && width > 0 && height > 0) {
      cartonCbm = (depth * width * height) / 1000000;
      unitPieceCbm = piecesPerCarton > 0 ? cartonCbm / piecesPerCarton : cartonCbm;
    }

    if (name || productId) {
      count++;
      bulkOps.push({
        insertOne: {
          document: {
            productId,
            name: name || productId,
            weight,
            depth,
            width,
            height,
            piecesPerCarton,
            cartonsPerPallet,
            category: String(category).trim(),
            cartonCbm,
            cbm: unitPieceCbm,
            destinationLocation: cleanStr(getVal(row, ['Destination Location', 'Stock move/Destination Location', 'موقع الوجهة', 'الموقع'])),
            branchName: cleanStr(getVal(row, ['Branch Name', 'Branch', 'الفرع'])),
            sourceTab: cleanStr(row._sourceTab || '')
          }
        }
      });
    }
  }

  // Execute in batches to respect MongoDB BSON and memory limits
  const BATCH_SIZE = 2000;
  for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
    const chunk = bulkOps.slice(i, i + BATCH_SIZE);
    await Product.bulkWrite(chunk, { ordered: false });
  }

  return {
    count,
    totalRows: data.length
  };
}

/**
 * Parses Excel / CSV buffer and upserts products
 * Checks 'Data' first, then falls back to 'Single Items' for missing IDs
 */
async function parseAndUpsertProducts(fileBuffer) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Workbook contains no sheets');
  }

  const sheetNames = workbook.SheetNames || [];
  const dataSheetName = sheetNames.find(s => s.trim().toLowerCase() === 'data');
  const singleSheetName = sheetNames.find(s => ['single items', 'single item', 'singleitems', 'single_items'].includes(s.trim().toLowerCase()));

  let data = [];
  if (dataSheetName || singleSheetName) {
    const dataRows = dataSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[dataSheetName]) : [];
    const singleRows = singleSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[singleSheetName]) : [];
    data = mergeDataAndSingleItems(dataRows, singleRows);
  } else {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    data = xlsx.utils.sheet_to_json(sheet);
  }

  return await processRowObjects(data);
}

/**
 * Reads Google Sheet using official Google Sheets API v4 with Service Account:
 * Finds ID in 'Data'; if not found, finds in 'Single Items' tab
 */
async function fetchSheetDataViaServiceAccount(spreadsheetId, keyFilePath) {
  console.log(`[GoogleSheetSync] Authenticating via Service Account: ${keyFilePath}`);
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Fetch metadata to inspect available tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];
  if (sheetList.length === 0) {
    throw new Error('The Google Spreadsheet has no sheets');
  }

  const dataSheet = sheetList.find(s => s.properties.title.trim().toLowerCase() === 'data');
  const singleSheet = sheetList.find(s => ['single items', 'single item', 'singleitems', 'single_items'].includes(s.properties.title.trim().toLowerCase()));

  // If neither 'Data' nor 'Single Items' exists, fall back to the first sheet
  if (!dataSheet && !singleSheet) {
    const firstSheetTitle = sheetList[0].properties.title;
    console.log(`[GoogleSheetSync] Reading default first sheet: "${firstSheetTitle}"`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${firstSheetTitle}'!A1:ZZ`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    return sheetValuesToObjects(response.data.values);
  }

  let dataRows = [];
  let singleRows = [];

  // Fetch 'Data' tab
  if (dataSheet) {
    console.log(`[GoogleSheetSync] Fetching primary sheet: "${dataSheet.properties.title}"`);
    const resData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${dataSheet.properties.title}'!A1:ZZ`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    dataRows = sheetValuesToObjects(resData.data.values);
  }

  // Fetch 'Single Items' tab
  if (singleSheet) {
    console.log(`[GoogleSheetSync] Fetching secondary sheet: "${singleSheet.properties.title}"`);
    const resSingle = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${singleSheet.properties.title}'!A1:ZZ`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    singleRows = sheetValuesToObjects(resSingle.data.values);
  }

  // Find ID in Data; if not found, find in Single Items
  return mergeDataAndSingleItems(dataRows, singleRows);
}

/**
 * Downloads sheet using public export link as fallback
 */
async function fetchSheetDataViaExportLink(spreadsheetId) {
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
  const dataSheetName = sheetNames.find(s => s.trim().toLowerCase() === 'data');
  const singleSheetName = sheetNames.find(s => ['single items', 'single item', 'singleitems', 'single_items'].includes(s.trim().toLowerCase()));

  if (!dataSheetName && !singleSheetName) {
    const defaultSheet = workbook.Sheets[sheetNames[0]];
    return xlsx.utils.sheet_to_json(defaultSheet);
  }

  const dataRows = dataSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[dataSheetName]) : [];
  const singleRows = singleSheetName ? xlsx.utils.sheet_to_json(workbook.Sheets[singleSheetName]) : [];

  return mergeDataAndSingleItems(dataRows, singleRows);
}

/**
 * Main synchronization method
 */
async function syncFromGoogleSheet(sheetUrlOverride = null) {
  let config = await SyncConfig.findOne({ key: 'googleSheetSync' });
  if (!config) {
    config = new SyncConfig({
      key: 'googleSheetSync',
      googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
      cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 6 * * *'
    });
    await config.save();
  }

  const configuredSource = sheetUrlOverride || process.env.GOOGLE_SHEET_URL || config.googleSheetUrl;
  const spreadsheetId = extractSpreadsheetId(configuredSource);

  if (!spreadsheetId) {
    const err = 'Google Sheet ID or link not specified in backend/.env file (GOOGLE_SHEET_URL)';
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
        rowObjects = await fetchSheetDataViaServiceAccount(spreadsheetId, serviceAccountKeyPath);
      } catch (saError) {
        console.warn(`[GoogleSheetSync] Service Account error (${saError.message}). Attempting export fallback...`);
        try {
          rowObjects = await fetchSheetDataViaExportLink(spreadsheetId);
        } catch (exportError) {
          if (saError.message && saError.message.includes('invalid_grant')) {
            throw new Error(
              'Google Auth failed with "invalid_grant" (System clock out of sync). Please synchronize your computer\'s date and time in Windows Settings.'
            );
          }
          let saEmail = 'your-service-account-email';
          try {
            const saData = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf8'));
            if (saData.client_email) saEmail = saData.client_email;
          } catch (_) {}

          if (saError.status === 403 || saError.status === 404 || saError.code === 403 || saError.code === 404) {
            throw new Error(
              `Failed to access Google Sheet via Service Account. Please ensure the sheet is shared and the following email is added as Viewer:\n${saEmail}`
            );
          }
          throw saError;
        }
      }
    } else {
      console.log('[GoogleSheetSync] No service-account.json found. Trying export link fallback...');
      rowObjects = await fetchSheetDataViaExportLink(spreadsheetId);
    }

    const { count, totalRows } = await processRowObjects(rowObjects);

    config.lastSyncAt = new Date();
    config.lastSyncStatus = 'success';
    config.productsUpdatedCount = count;
    config.lastSyncMessage = `Sync completed! ${count} products updated from ${totalRows} rows in sheet (Data + Single Items fallback).`;
    await config.save();

    console.log(`[GoogleSheetSync] Success: ${config.lastSyncMessage}`);
    return {
      success: true,
      count,
      totalRows,
      message: config.lastSyncMessage,
      lastSyncAt: config.lastSyncAt
    };
  } catch (error) {
    console.error('[GoogleSheetSync] Error:', error.message);
    config.lastSyncAt = new Date();
    config.lastSyncStatus = 'error';
    config.lastSyncMessage = error.message;
    await config.save();
    throw error;
  }
}

/**
 * Gets current sync status & config
 */
async function getSyncStatus() {
  let config = await SyncConfig.findOne({ key: 'googleSheetSync' });
  if (!config) {
    config = await SyncConfig.create({
      key: 'googleSheetSync',
      googleSheetUrl: process.env.GOOGLE_SHEET_URL || '',
      cronSchedule: process.env.SYNC_CRON_SCHEDULE || '0 6 * * *'
    });
  }

  const productCount = await Product.countDocuments();
  const keyPath = findServiceAccountKeyPath();
  let serviceAccountEmail = null;

  if (keyPath) {
    try {
      const saData = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      serviceAccountEmail = saData.client_email || null;
    } catch (_) {}
  }

  return {
    googleSheetUrl: process.env.GOOGLE_SHEET_URL || config.googleSheetUrl,
    cronSchedule: config.cronSchedule,
    autoSyncEnabled: config.autoSyncEnabled,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    lastSyncMessage: config.lastSyncMessage,
    productsUpdatedCount: config.productsUpdatedCount,
    totalProductsInDb: productCount,
    hasServiceAccount: Boolean(keyPath),
    serviceAccountEmail
  };
}

module.exports = {
  findServiceAccountKeyPath,
  extractSpreadsheetId,
  mergeDataAndSingleItems,
  parseAndUpsertProducts,
  syncFromGoogleSheet,
  getSyncStatus
};
