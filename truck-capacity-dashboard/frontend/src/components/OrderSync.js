import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Truck, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Table 
} from 'lucide-react';

const OrderSync = ({ onSyncSuccess }) => {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncMessage, setSyncMessage] = useState({ text: '', type: '' });

  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/orders/sync-status');
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Error fetching order sync status:', error);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const handleSyncOrders = async () => {
    setSyncing(true);
    setSyncMessage({ text: '', type: '' });
    try {
      const response = await axios.post('http://localhost:5000/api/orders/sync-sheet', {});
      setSyncMessage({ 
        text: response.data.message || `Successfully synced orders for ${response.data.orders?.length || 0} branches!`, 
        type: 'success' 
      });
      if (onSyncSuccess) {
        onSyncSuccess(response.data);
      }
      await fetchSyncStatus();
    } catch (error) {
      console.error('Error syncing orders:', error);
      const errMsg = error.response?.data?.message || error.message || 'Error syncing orders from Google Sheet';
      setSyncMessage({ text: errMsg, type: 'error' });
    } finally {
      setSyncing(false);
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
          <Truck className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">Daily Orders (Odoo)</h3>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 flex items-center gap-1">
          <Table className="w-3 h-3" />
          Tab: Orders
        </span>
      </div>

      {/* Schedule Info Banner */}
      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 mb-4 text-xs text-indigo-900 flex items-center">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span>
            <strong>Automatic Sync:</strong> Linked to Google Sheet tab <strong>Orders</strong>
          </span>
        </div>
      </div>

      {/* Primary Action: Sync Orders Button */}
      <button
        onClick={handleSyncOrders}
        disabled={syncing}
        className={`w-full py-3 px-4 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition-all ${
          syncing
            ? 'bg-indigo-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-[0.99] cursor-pointer'
        }`}
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        <span>{syncing ? 'Syncing orders from Google Sheet...' : 'Sync Orders'}</span>
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
            Branches: <strong className="text-slate-700">{syncStatus.branchCount || 0}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSync;
