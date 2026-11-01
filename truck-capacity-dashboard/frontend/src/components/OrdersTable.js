import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';

const OrdersTable = ({ orders }) => {
  const [expandedOrders, setExpandedOrders] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [truckFilter, setTruckFilter] = useState('all');

  const toggleExpand = (id) => {
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!orders || orders.length === 0) {
    return <div className="text-center py-10 text-slate-500">No data for today. Please upload the daily orders file.</div>;
  }

  const zones = [...new Set(orders.map(order => order.zone).filter(Boolean))].sort();
  const filteredOrders = orders.filter((order) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch = !search ||
      String(order.branchName || '').toLowerCase().includes(search) ||
      String(order.zone || '').toLowerCase().includes(search);
    const matchesZone = zoneFilter === 'all' || order.zone === zoneFilter;
    const recommendedTrucks = order.recommendedTrucks || {};
    const matchesTruck = truckFilter === 'all' || recommendedTrucks[truckFilter] > 0;

    return matchesSearch && matchesZone && matchesTruck;
  });
  const hasActiveFilters = searchTerm || zoneFilter !== 'all' || truckFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setZoneFilter('all');
    setTruckFilter('all');
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            Filter Branches
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing <strong className="text-slate-700">{filteredOrders.length}</strong> of{' '}
              <strong className="text-slate-700">{orders.length}</strong> branches
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="relative block">
            <span className="sr-only">Search branches</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search branch or zone..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label>
            <span className="sr-only">Filter by zone</span>
            <select
              value={zoneFilter}
              onChange={(event) => setZoneFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All zones</option>
              {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by recommended truck</span>
            <select
              value={truckFilter}
              onChange={(event) => setTruckFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All recommended trucks</option>
              <option value="jumbo4m">Jumbo 4M</option>
              <option value="NKR">NKR</option>
              <option value="dabbaba">Dabbaba</option>
            </select>
          </label>
        </div>
      </div>

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
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order) => {
            const isExpanded = !!expandedOrders[order._id];
            const hasItems = order.items && order.items.length > 0;
            const itemsByCategory = hasItems
              ? order.items.reduce((groups, item) => {
                const category = item.category || 'Uncategorized';
                if (!groups[category]) {
                  groups[category] = [];
                }
                groups[category].push(item);
                return groups;
              }, {})
              : {};

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
                      {order.recommendedTrucks?.NKR > 0 && (
                        <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded text-xs font-semibold">
                          NKR ({order.recommendedTrucks.NKR})
                        </span>
                      )}
                      {order.recommendedTrucks?.dabbaba > 0 && (
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-semibold">
                          Dabbaba ({order.recommendedTrucks.dabbaba})
                        </span>
                      )}
                    </div>
                  </td>
                </tr>

                {isExpanded && hasItems && (
                  <tr className="bg-slate-50/70 border-b">
                    <td></td>
                    <td colSpan={5} className="px-6 py-3">
                      <div className="bg-white border rounded-lg p-3 shadow-sm">
                        <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                          Branch Item Breakdown ({order.branchName})
                        </div>
                        <div className="space-y-4">
                          {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
                            <div key={category} className="border border-slate-200 rounded-lg overflow-hidden">
                              <div className="bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                {category}
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
                                  {categoryItems.map((item, idx) => (
                                    <tr key={`${category}-${idx}`} className="border-b last:border-none hover:bg-slate-50">
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
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
          {filteredOrders.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Search className="w-8 h-8 text-slate-300" />
                  <p className="font-semibold text-slate-600">No branches match your filters</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Clear filters and show all branches
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default OrdersTable;
