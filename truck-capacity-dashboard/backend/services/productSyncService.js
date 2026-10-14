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
 * Gets value from row matching possible column keys
 */
function getVal(rowObj, possibleKeys) {
  const keys = Object.keys(rowObj);
  for (const key of possibleKeys) {
    if (rowObj[key] !== undefined && rowObj[key] !== null && rowObj[key] !== '') {
      return rowObj[key];
    }
  }
  for (const key of possibleKeys) {
    const normTarget = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const foundKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normTarget);
    if (foundKey && rowObj[foundKey] !== undefined && rowObj[foundKey] !== null && rowObj[foundKey] !== '') {
      return rowObj[foundKey];
    }
  }
  return undefined;
}

/**
 * Normalizes rows and bulk-upserts into Product collection
 */
async function processRowObjects(data) {
  if (!data || data.length === 0) {
    throw new Error('No product rows found in data');
  }

  let count = 0;
  const bulkOps = data.map(row => {
    const keys = Object.keys(row);

    let productId = getVal(row, [
      'ID', 'Stock move/Product/Internal Reference', 'Stock move/Product/Internal_Reference',
      'Product ID', 'Product/ID', 'Product Code', 'Item ID', 'كود المنتج', 'كود الصنف', 'كود',
      'Internal Reference', 'Default Code', 'SKU', 'Barcode', 'Item Code', 'Code'
    ]);

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

    const depth = parseNum(getVal(row, ['dimension_depth_cm', 'dimension_depth', 'depth_cm', 'depth', 'Length', 'طول', 'الطول', 'عمق']));
    const width = parseNum(getVal(row, ['dimension_width_cm', 'dimension_width', 'width_cm', 'width', 'Width', 'عرض', 'العرض']));
    const height = parseNum(getVal(row, ['dimension_height_cm', 'dimension_height', 'height_cm', 'height', 'Height', 'ارتفاع', 'الارتفاع']));
    const weight = parseNum(getVal(row, ['Weight', 'weight', 'weight_kg', 'الوزن', 'وزن']));
    const piecesPerCarton = parseNum(getVal(row, ['pieces/cartons', 'pieces_cartons', 'pieces/carton', 'Pieces Per Carton', 'pieces per carton', 'عدد القطع بالكرتونة', 'قطع/كرتونة']));
    const cartonsPerPallet = parseNum(getVal(row, ['cartons/pallets', 'cartons_pallets', 'cartons/pallet', 'Cartons Per Pallet', 'cartons per pallet', 'عدد الكراتين بالبالتة', 'كرتونة/بالتة']));
    const category = getVal(row, ['Product/Financial Category', 'Category', 'الفئة', 'فئة']) || '';

    let cartonCbm = parseNum(
      getVal(row, ['CBM', 'cbm', 'Volume', 'Volume (m³)', 'Volume (m3)', 'Total CBM', 'Unit CBM', 'CBM/Unit', 'الحجم', 'حجم'])
    );

    if (cartonCbm <= 0) {
      if (depth > 0 && width > 0 && height > 0) {
        cartonCbm = (depth * width * height) / 1000000;
      } else {
        cartonCbm = 0;
      }
    } else if (cartonCbm > 5) {
      cartonCbm = cartonCbm > 1000 ? cartonCbm / 1000000 : cartonCbm / 1000;
    }

    let unitPieceCbm = cartonCbm;
    if (piecesPerCarton > 0 && cartonCbm > 0) {
      unitPieceCbm = cartonCbm / piecesPerCarton;
    }

    if (name || productId) {
      count++;
      const filter = productId ? { productId } : { name };
      return {
        updateOne: {
          filter,
          update: {
            $set: {
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
              cbm: unitPieceCbm
            }
          },
          upsert: true
        }
      };
    }
    return null;
  }).filter(op => op !== null);

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps);
  }

  return {
    count,
    totalRows: data.length
  };
}

/**
 * Parses Excel / CSV buffer and upserts products
 */
async function parseAndUpsertProducts(fileBuffer) {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Workbook contains no sheets');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  return await processRowObjects(data);
}

/**
 * Reads Google Sheet using official Google Sheets API v4 with Service Account
 */
async function fetchSheetDataViaServiceAccount(spreadsheetId, keyFilePath) {
  console.log(`[GoogleSheetSync] Authenticating via Service Account: ${keyFilePath}`);
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Fetch metadata to get the first sheet name
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetList = meta.data.sheets || [];
  if (sheetList.length === 0) {
    throw new Error('The Google Spreadsheet has no sheets');
  }

  const firstSheetTitle = sheetList[0].properties.title;
  console.log(`[GoogleSheetSync] Reading first sheet: "${firstSheetTitle}"`);

  // 2. Fetch all values
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${firstSheetTitle}'!A1:ZZ`,
    valueRenderOption: 'UNFORMATTED_VALUE'
  });

  const values = response.data.values;
  if (!values || values.length === 0) {
    throw new Error(`Sheet "${firstSheetTitle}" is empty or has no data`);
  }

  const headers = values[0];
  const rowObjects = values.slice(1).map(row => {
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

/**
 * Downloads sheet using public export link as fallback
 */
async function fetchSheetDataViaExportLink(spreadsheetId) {
  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const response = await axios.get(exportUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const workbook = xlsx.read(Buffer.from(response.data), { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json(sheet);
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
      // Method 1: Google Service Account
      try {
        rowObjects = await fetchSheetDataViaServiceAccount(spreadsheetId, serviceAccountKeyPath);
      } catch (saError) {
        // If 403 / 404 from Google Sheets API, provide actionable email info
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
    } else {
      // Method 2: Fallback to Export link
      console.log('[GoogleSheetSync] No service-account.json found. Trying export link fallback...');
      try {
        rowObjects = await fetchSheetDataViaExportLink(spreadsheetId);
      } catch (exportError) {
        throw new Error(
          'Failed to access Google Sheet. No service-account.json found in backend folder. Please place the key file as service-account.json inside the backend folder and confirm the sheet is shared with the Service Account email.'
        );
      }
    }

    const { count, totalRows } = await processRowObjects(rowObjects);

    config.lastSyncAt = new Date();
    config.lastSyncStatus = 'success';
    config.productsUpdatedCount = count;
    config.lastSyncMessage = `Sync completed! ${count} products updated from ${totalRows} rows in the sheet.`;
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
  parseAndUpsertProducts,
  syncFromGoogleSheet,
  getSyncStatus
};
