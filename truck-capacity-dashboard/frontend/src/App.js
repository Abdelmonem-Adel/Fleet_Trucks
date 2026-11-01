import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Download, Printer } from 'lucide-react';
import OrderSync from './components/OrderSync';
import ProductUpload from './components/ProductUpload';
import KPIHeader from './components/KPIHeader';
import ConsolidationAlerts from './components/ConsolidationAlerts';
import OrdersTable from './components/OrdersTable';
import AnalyticsChart from './components/AnalyticsChart';
import './App.css';

function App() {
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLatestOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/orders/latest');
      setOrders(response.data.orders || []);
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestOrders();
  }, []);

  const handleUploadSuccess = (data) => {
    setOrders(data.orders);
    setAlerts(data.alerts);
  };

  const handleExportExcel = () => {
    window.open('http://localhost:5000/api/orders/export', '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteLatest = async () => {
    if (window.confirm('Are you sure you want to delete the latest uploaded data?')) {
      try {
        setLoading(true);
        await axios.delete('http://localhost:5000/api/orders/latest');
        setOrders([]);
        setAlerts([]);
      } catch (error) {
        console.error('Error deleting latest orders:', error);
        alert('Error deleting data');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 font-sans">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <img src="/Logo.png" alt="Logo" className="h-16 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Fleet Control Dashboard</h1>
            <p className="text-slate-500 mt-1">Truck Capacity & Logistics Optimization System</p>
          </div>
        </div>
      </header>

      {alerts.length > 0 && <ConsolidationAlerts alerts={alerts} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: KPI Header + Branch Details Table */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <KPIHeader orders={orders} />
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-slate-800">Branch Details & Recommended Trucks</h2>
              {orders.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors font-medium text-xs border border-emerald-200"
                    title="Export Dispatch Plan to Excel"
                  >
                    <Download className="w-4 h-4" />
                    Export Excel
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors font-medium text-xs border border-slate-200"
                    title="Print or Save PDF Report"
                  >
                    <Printer className="w-4 h-4" />
                    Print PDF
                  </button>
                  <button 
                    onClick={handleDeleteLatest}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors font-medium text-xs border border-red-200"
                    title="Delete today's uploaded data"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Today
                  </button>
                </div>
              )}
            </div>
            {loading ? (
              <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
            ) : (
              <OrdersTable orders={orders} />
            )}
          </div>
        </div>

        {/* Right Column: Upload Controls + Analytics */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <OrderSync onSyncSuccess={handleUploadSuccess} />
          <ProductUpload />
          <AnalyticsChart orders={orders} />
        </div>
      </div>
    </div>
  );
}

export default App;
