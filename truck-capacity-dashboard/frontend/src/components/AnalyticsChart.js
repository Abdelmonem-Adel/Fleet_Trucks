import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const AnalyticsChart = ({ orders }) => {
  if (!orders || orders.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[300px] flex items-center justify-center">
        <p className="text-slate-400">No data to display</p>
      </div>
    );
  }

  // Sort by CBM descending and take top 10
  const data = [...orders]
    .sort((a, b) => b.totalCbm - a.totalCbm)
    .slice(0, 10)
    .map(order => ({
      name: order.branchName,
      cbm: parseFloat(order.totalCbm.toFixed(2))
    }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-100 text-sm">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-indigo-600 font-medium">Volume: {payload[0].value} CBM</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h2 className="text-lg font-bold mb-6 text-slate-800 border-b pb-4">Top 10 Branches by Volume (CBM)</h2>
      <div className="h-[300px] w-full mt-4" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 11, fill: '#64748b' }} 
              angle={-45} 
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="cbm" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index < 3 ? '#4f46e5' : '#a5b4fc'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AnalyticsChart;
