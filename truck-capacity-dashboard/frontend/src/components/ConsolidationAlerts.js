import React, { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp, Lightbulb, Truck } from 'lucide-react';

const ConsolidationAlerts = ({ alerts }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="overflow-hidden rounded-2xl border border-orange-200/80 bg-white shadow-sm">
        <div className="relative bg-gradient-to-r from-orange-50 via-amber-50 to-white px-5 py-5 sm:px-6">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-orange-100/60 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm shadow-orange-200">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Smart Branch Consolidation</h3>
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-700">
                    Recommendations
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Optimize routes by combining nearby branch deliveries.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-2xl font-extrabold leading-none text-orange-600">{alerts.length}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {alerts.length === 1 ? 'Opportunity' : 'Opportunities'}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3.5 py-2 text-sm font-semibold text-orange-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50"
                title={isOpen ? 'Hide recommendations' : 'Show recommendations'}
              >
                <span>{isOpen ? 'Hide details' : 'View recommendations'}</span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Lightbulb className="h-4 w-4 text-orange-500" />
              Suggested actions
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {alerts.map((alert, index) => (
                <li
                  key={index}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 text-xs font-extrabold text-orange-700">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-slate-700">{alert}</p>
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-orange-600 opacity-80">
                      Consolidation opportunity
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsolidationAlerts;
