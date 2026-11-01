const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const OrderSummary = require('../models/OrderSummary');
const Product = require('../models/Product');
const { calculateTrucks, getConsolidationSuggestions } = require('../utils/truckCalculator');

const upload = multer({ storage: multer.memoryStorage() });

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
  const combined = (String(branchName) + ' ' + String(rawLocation)).toLowerCase();
  if (combined.includes('october') || combined.includes('zayed') || combined.includes('اكتوبر') || combined.includes('زايد') || combined.includes('haram') || combined.includes('الهرم') || combined.includes('faisal') || combined.includes('فيصل') || combined.includes('giza') || combined.includes('الجيزة') || combined.includes('dokki') || combined.includes('الدقي') || combined.includes('mohandessin') || combined.includes('المهندسين')) {
    return 'Giza / 6th of October';
  }
  if (combined.includes('maadi') || combined.includes('mokattam') || combined.includes('المعادي') || combined.includes('المقطم') || combined.includes('helwan') || combined.includes('حلوان') || combined.includes('basateen') || combined.includes('البساتين')) {
    return 'South Cairo';
  }
  if (combined.includes('nasr') || combined.includes('heliopolis') || combined.includes('مدينة نصر') || combined.includes('مصر الجديدة') || combined.includes('sheraton') || combined.includes('شيراتون') || combined.includes('nozha') || combined.includes('النزهة') || combined.includes('obour') || combined.includes('العبور') || combined.includes('shorouk') || combined.includes('الشروق')) {
    return 'East Cairo';
  }
  if (combined.includes('tagamoa') || combined.includes('rehab') || combined.includes('madinaty') || combined.includes('التجمع') || combined.includes('الرحاب') || combined.includes('مدينتي') || combined.includes('mostakbal') || combined.includes('المستقبل') || combined.includes('new cairo') || combined.includes('القاهرة الجديدة')) {
    return 'New Cairo';
  }
  if (combined.includes('alex') || combined.includes('اسكندرية') || combined.includes('الإسكندرية') || combined.includes('agami') || combined.includes('العجمي') || combined.includes('smouha') || combined.includes('سموحة')) {
    return 'Alexandria';
  }
  return 'General Zone';
};

function parseSheetData(sheet) {
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
      rowStr.includes('barcode') ||
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

const { 
  processOrderRows, 
  syncOrdersFromGoogleSheet, 
  getOrderSyncStatus 
} = require('../services/orderSyncService');


router.post('/sync-sheet', async (req, res) => {
  try {
    const { sheetUrl } = req.body || {};
    const result = await syncOrdersFromGoogleSheet(sheetUrl);
    res.status(200).json(result);
  } catch (error) {
    console.error('[Orders Sync Error]:', error);
    res.status(500).json({
      message: error.message || 'Error synchronizing orders from Google Sheets',
      details: error.toString()
    });
  }
});


router.get('/sync-status', async (req, res) => {
  try {
    const status = await getOrderSyncStatus();
    res.status(200).json(status);
  } catch (error) {
    console.error('[Orders Sync Status Error]:', error);
    res.status(500).json({ message: 'Error retrieving order sync status' });
  }
});


router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = parseSheetData(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ message: 'No valid data rows found in uploaded file' });
    }

    const result = await processOrderRows(data);

    res.status(200).json({ 
      message: 'File processed successfully', 
      orders: result.orders,
      alerts: result.alerts,
      missingProducts: result.missingProducts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error processing file' });
  }
});

router.get('/latest', async (req, res) => {
  try {

    const latestOrder = await OrderSummary.findOne().sort({ date: -1 });
    if (!latestOrder) {
      return res.status(200).json({ orders: [], alerts: [] });
    }

    const startOfDay = new Date(latestOrder.date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(latestOrder.date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await OrderSummary.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    const alerts = getConsolidationSuggestions(orders);

    res.status(200).json({ orders, alerts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching latest orders' });
  }
});

router.delete('/latest', async (req, res) => {
  try {
    const latestOrder = await OrderSummary.findOne().sort({ date: -1 });
    if (!latestOrder) {
      return res.status(200).json({ message: 'No orders found to delete' });
    }

    const startOfDay = new Date(latestOrder.date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(latestOrder.date);
    endOfDay.setHours(23, 59, 59, 999);

    await OrderSummary.deleteMany({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    res.status(200).json({ message: 'Today\'s data cleared successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting orders' });
  }
});

router.patch('/:id/actual', async (req, res) => {
  try {
    const { actualTrucks } = req.body;
    const order = await OrderSummary.findByIdAndUpdate(
      req.params.id, 
      { actualTrucks },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.status(200).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error updating order' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const latestOrder = await OrderSummary.findOne().sort({ date: -1 });
    if (!latestOrder) {
      return res.status(404).json({ message: 'No orders available to export' });
    }

    const startOfDay = new Date(latestOrder.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(latestOrder.date);
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await OrderSummary.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    
    const summaryRows = orders.map(o => ({
      'Branch Name': o.branchName,
      'Zone': o.zone || '',
      'Total QTY': o.totalQty,
      'Total Volume (CBM)': parseFloat((o.totalCbm || 0).toFixed(3)),
      'Recommended Jumbo 4M': o.recommendedTrucks?.jumbo4m || 0,
      'Recommended NKR': o.recommendedTrucks?.NKR || 0,
      'Recommended Dabbaba': o.recommendedTrucks?.dabbaba || 0,
      'Actual Trucks': o.actualTrucks || ''
    }));

    
    const itemRows = [];
    orders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(item => {
          itemRows.push({
            'Branch Name': o.branchName,
            'Zone': o.zone || '',
            'Product ID': item.productId || '',
            'Product Name': item.productName || '',
            'Unit CBM': parseFloat((item.unitCbm || 0).toFixed(4)),
            'QTY': item.qty,
            'Total Item CBM': parseFloat((item.cbm || 0).toFixed(3))
          });
        });
      }
    });

    const wb = xlsx.utils.book_new();
    const summarySheet = xlsx.utils.json_to_sheet(summaryRows);
    xlsx.utils.book_append_sheet(wb, summarySheet, 'Branch Logistics Summary');

    if (itemRows.length > 0) {
      const itemSheet = xlsx.utils.json_to_sheet(itemRows);
      xlsx.utils.book_append_sheet(wb, itemSheet, 'Item Breakdown');
    }

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const formattedDate = startOfDay.toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Truck_Dispatch_Report_${formattedDate}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting orders:', error);
    res.status(500).json({ message: 'Server error generating export file' });
  }
});

module.exports = router;

