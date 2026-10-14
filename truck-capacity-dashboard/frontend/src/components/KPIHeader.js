import React from 'react';
import { Package, Box, Truck } from 'lucide-react';

const KPIHeader = ({ orders }) => {
  const totalBranches = orders.length;
  const totalCbm = orders.reduce((sum, order) => sum + (order.totalCbm || 0), 0).toFixed(2);

  const totalTrucks = orders.reduce((totals, order) => {
    totals.jumbo4m += order.recommendedTrucks?.jumbo4m || 0;
    totals.jumbo += order.recommendedTrucks?.jumbo || 0;
    totals.dabbaba += order.recommendedTrucks?.dabbaba || 0;
    return totals;
  }, { jumbo4m: 0, jumbo: 0, dabbaba: 0 });

  const kpis = [
    {
      title: 'Total Branches',
      value: totalBranches,
      icon: <Package className="w-5 h-5 text-blue-600" />,
      bgColor: 'bg-blue-50/80',
      borderColor: 'border-blue-200/60',
    },
    {
      title: 'Total Volume (CBM)',
      value: totalCbm,
      icon: <Box className="w-5 h-5 text-purple-600" />,
      bgColor: 'bg-purple-50/80',
      borderColor: 'border-purple-200/60',
    },
    {
      title: 'Recommended Trucks',
      value: (
        <div className="flex flex-wrap gap-1.5 text-xs mt-1">
          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-semibold border border-indigo-200/50">Jumbo 4M: {totalTrucks.jumbo4m}</span>
          <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded-md font-semibold border border-pink-200/50">Jumbo: {totalTrucks.jumbo}</span>
          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-semibold border border-amber-200/50">Dabbaba: {totalTrucks.dabbaba}</span>
        </div>
      ),
      icon: <Truck className="w-5 h-5 text-indigo-600" />,
      bgColor: 'bg-indigo-50/80',
      borderColor: 'border-indigo-200/60',
      isComponent: true
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {kpis.map((kpi, index) => (
        <div key={index} className={`rounded-xl p-4 border shadow-sm flex items-center gap-3.5 transition-all hover:shadow-md ${kpi.bgColor} ${kpi.borderColor}`}>
          <div className="p-2.5 bg-white rounded-xl shadow-xs flex-shrink-0">
            {kpi.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">{kpi.title}</h3>
            {kpi.isComponent ? (
              kpi.value
            ) : (
              <p className="text-2xl font-extrabold text-slate-800 leading-tight mt-0.5">{kpi.value}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPIHeader;
