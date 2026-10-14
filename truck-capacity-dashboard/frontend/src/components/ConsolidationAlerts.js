import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const ConsolidationAlerts = ({ alerts }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
            <h3 className="text-orange-800 font-bold">Smart Branch Consolidation Recommendations</h3>
            <span className="bg-orange-200 text-orange-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              {alerts.length}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-lg text-sm font-medium transition-colors border border-orange-300 flex-shrink-0 cursor-pointer"
            title={isOpen ? 'Close alerts' : 'Open alerts'}
          >
            <span>{isOpen ? 'Close' : 'Open'}</span>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isOpen && (
          <ul className="space-y-2 mt-4 pt-3 border-t border-orange-200/80">
            {alerts.map((alert, index) => (
              <li key={index} className="flex items-start gap-2 text-orange-700 bg-white/60 p-2.5 rounded-lg border border-orange-100">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0"></span>
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConsolidationAlerts;

