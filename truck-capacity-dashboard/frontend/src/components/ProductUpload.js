import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Database, 
  CheckCircle, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  Trash2 
} from 'lucide-react';

const ProductUpload = () => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState({ text: '', type: '' });

  // Fetch Sync Status on mount
  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/products/sync-status');
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  // Immediate Sync from Google Sheets (uses URL configured in backend .env)
  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage({ text: '', type: '' });
    try {
      const response = await axios.post('http://localhost:5000/api/products/sync-sheet', {});
      setSyncMessage({ 
        text: `Sync completed successfully! ${response.data.count || 0} products updated.`, 
        type: 'success' 
      });
      await fetchSyncStatus();
    } catch (error) {
      console.error('Error syncing products:', error);
      const errMsg = error.response?.data?.message || error.message || 'Error Syncing products...';
      setSyncMessage({ text: errMsg, type: 'error' });
      await fetchSyncStatus();
    } finally {
      setSyncing(false);
    }
  };

  // Handle Clear Master Data
  const handleDeleteMaster = async () => {
    if (window.confirm('Are you sure you want to delete all product data (Master Data)?')) {
      try {
        await axios.delete('http://localhost:5000/api/products/all');
        setSyncMessage({ text: 'Deleted all products successfully.', type: 'info' });
        await fetchSyncStatus();
      } catch (error) {
        console.error('Error deleting master data:', error);
        alert('Error deleting master data...');
      }
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not yet';
    const d = new Date(dateString);
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600" />
          <h3 className="text-lg font-bold text-slate-800">Upload Products (Products Master)</h3>
        </div>
        <button
          onClick={handleDeleteMaster}
          className="text-xs px-2.5 py-1 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 font-medium transition-all border border-red-200 cursor-pointer"
          title="Delete All Products"
        >
          Delete All Products
        </button>
      </div>

      {/* Schedule Info Banner */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4 text-xs text-emerald-800 flex items-center">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            <strong>Automatic Sync:</strong> Updates daily at <strong>06:00 AM</strong>
          </span>
        </div>
      </div>

      {/* Primary Action: Sync Now Button */}
      <button
        onClick={handleSyncNow}
        disabled={syncing}
        className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all ${
          syncing
            ? 'bg-emerald-400 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-200 active:scale-[0.99] cursor-pointer'
        }`}
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        <span>{syncing ? 'Syncing products from Google Sheets...' : 'Sync Now'}</span>
      </button>

      {/* Sync Message Alert */}
      {syncMessage.text && (
        <div
          className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
            syncMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : syncMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {syncMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 mt-0.5" />
          )}
          <span className="leading-snug">{syncMessage.text}</span>
        </div>
      )}

      {/* Status Info Footer */}
      {syncStatus && (
        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                syncStatus.lastSyncStatus === 'success'
                  ? 'bg-emerald-500'
                  : syncStatus.lastSyncStatus === 'error'
                  ? 'bg-red-500'
                  : syncStatus.lastSyncStatus === 'running'
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-slate-400'
              }`}
            />
            <span>Last Sync: <strong>{formatDateTime(syncStatus.lastSyncAt)}</strong></span>
          </div>
          <div>
            Total Products: <strong className="text-slate-700">{syncStatus.totalProductsInDb || 0}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductUpload;
