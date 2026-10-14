import React, { useState } from 'react';
import { Check, Edit2, ChevronDown, ChevronRight } from 'lucide-react';

const OrdersTable = ({ orders, onUpdateActual }) => {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});

  const toggleExpand = (id) => {
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleEdit = (order) => {
    setEditingId(order._id);
    setEditValue(order.actualTrucks || '');
  };

  const handleSave = (id) => {
    onUpdateActual(id, editValue);
    setEditingId(null);
  };

  if (!orders || orders.length === 0) {
    return <div className="text-center py-10 text-slate-500">No data for today. Please upload the daily orders file.</div>;
  }

  return (
    <div className="overflow-x-auto custom-scrollbar pb-4">
      <table className="w-full text-sm text-left text-slate-600">
        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
          <tr>
            <th scope="col" className="px-3 py-3 w-10"></th>
            <th scope="col" className="px-4 py-3 rounded-tl-lg">Branch Name</th>
            <th scope="col" className="px-4 py-3">Zone</th>
            <th scope="col" className="px-4 py-3 text-center">QTY</th>
            <th scope="col" className="px-4 py-3 text-center">CBM</th>
            <th scope="col" className="px-4 py-3">Recommended Trucks</th>
            <th scope="col" className="px-4 py-3 rounded-tr-lg">Actual Trucks</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isExpanded = !!expandedOrders[order._id];
            const hasItems = order.items && order.items.length > 0;

            return (
              <React.Fragment key={order._id}>
                <tr className="bg-white border-b hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-4 text-center">
                    {hasItems && (
                      <button
                        onClick={() => toggleExpand(order._id)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                        title="View Branch Items"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-800 flex items-center gap-2">
                    {order.branchName}
                    {hasItems && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded font-mono">
                        {order.items.length} items
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs">
                      {order.zone}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center font-medium">{order.totalQty ? order.totalQty.toLocaleString() : 0}</td>
                  <td className="px-4 py-4 text-center font-medium text-indigo-600">{(order.totalCbm || 0).toFixed(2)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {order.recommendedTrucks?.jumbo4m > 0 && (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-semibold">
                          Jumbo 4M ({order.recommendedTrucks.jumbo4m})
                        </span>
                      )}
                      {order.recommendedTrucks?.jumbo > 0 && (
                        <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded text-xs font-semibold">
                          Jumbo ({order.recommendedTrucks.jumbo})
                        </span>
                      )}
                      {order.recommendedTrucks?.dabbaba > 0 && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">
                          Dabbaba ({order.recommendedTrucks.dabbaba})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {editingId === order._id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="border border-slate-300 rounded px-2 py-1 w-24 text-sm focus:outline-none focus:border-indigo-500"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Enter count"
                        />
                        <button onClick={() => handleSave(order._id)} className="text-green-600 hover:text-green-700">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => handleEdit(order)}>
                        <span className={order.actualTrucks ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                          {order.actualTrucks || 'Not set'}
                        </span>
                        <Edit2 className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </td>
                </tr>

                {isExpanded && hasItems && (
                  <tr className="bg-slate-50/70 border-b">
                    <td></td>
                    <td colSpan={6} className="px-6 py-3">
                      <div className="bg-white border rounded-lg p-3 shadow-sm">
                        <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                          Branch Item Breakdown ({order.branchName})
                        </div>
                        <table className="w-full text-xs text-left text-slate-700">
                          <thead className="bg-slate-100 font-semibold border-b">
                            <tr>
                              <th className="py-2 px-3">Product ID</th>
                              <th className="py-2 px-3">Product Name</th>
                              <th className="py-2 px-3 text-center">Unit CBM</th>
                              <th className="py-2 px-3 text-center">QTY</th>
                              <th className="py-2 px-3 text-center">Total Item CBM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map((item, idx) => (
                              <tr key={idx} className="border-b last:border-none hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono text-slate-600">{item.productId || '-'}</td>
                                <td className="py-2 px-3 font-medium">{item.productName || '-'}</td>
                                <td className="py-2 px-3 text-center">{(item.unitCbm || 0).toFixed(4)}</td>
                                <td className="py-2 px-3 text-center font-semibold">{item.qty}</td>
                                <td className="py-2 px-3 text-center font-semibold text-indigo-600">{(item.cbm || 0).toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default OrdersTable;
