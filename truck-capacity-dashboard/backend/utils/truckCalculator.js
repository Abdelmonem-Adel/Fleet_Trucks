const Order = require('../models/OrderSummary.js');

const TRUCK_CAPACITIES = {
  JUMBO_4M: 21.0,
  NKR: 9.5,
  DABBABA: 5.0,
};

function calculateTrucks(cbm, branchName) {
  let remainingCbm = cbm;
  const trucks = {
    jumbo4m: 0,
    nkr: 0,
    dabbaba: 0,
  };

  const No_Jumbo = [
    "OUT 6th of October FP #3",
    "OUT 6th of October FP #7",
    "OUT Sheikh Zayed City FP #2",
    "OUT Haram FP#2",
    "OUT Garden City",
    "OUT Maadi FP #1",
    "OUT Maadi FP#3",
    "OUT Maadi FP#5",
    "OUT Al Rehab City FP #2",
    "OUT New Cairo FP #4",
    "OUT New Cairo FP#6",
    "OUT New Cairo FP #7",
    "OUT New Cairo FP #8",
    "OUT Shorouk FP #1",
    "OUT Shorouk FP #3",
    "OUT Nasr City FP#3", 
    "OUT Nasr City FP#4",
    "OUT Heliopolis FP #1",
    "OUT Heliopolis FP #2",
    "OUT Ein Shams FP#1",
    "OUT Manial FP#1"
  ];

  const normalize = (s) => String(s).trim().replace(/\s+/g, ' ').replace(/\s*#\s*/g, '#').toLowerCase();
  const normalizedBranch = normalize(branchName);
  if (No_Jumbo.some(name => normalize(name) === normalizedBranch)) {
    while (remainingCbm > 0) {
      trucks.dabbaba += 1;
      remainingCbm -= TRUCK_CAPACITIES.DABBABA;
    }
    return trucks;
  }
  

  while (remainingCbm > 0) {
    if (remainingCbm >= TRUCK_CAPACITIES.JUMBO_4M) {
      trucks.jumbo4m += 1;
      remainingCbm -= TRUCK_CAPACITIES.JUMBO_4M;
    } else if (remainingCbm >= TRUCK_CAPACITIES.NKR) {
      trucks.nkr += 1;
      remainingCbm -= TRUCK_CAPACITIES.NKR;
    } else if (remainingCbm > TRUCK_CAPACITIES.DABBABA && remainingCbm <= TRUCK_CAPACITIES.NKR) {
      trucks.nkr += 1;
      remainingCbm = 0;
    } else {
      trucks.dabbaba += 1;
      remainingCbm = 0;
    }
  }

  return trucks;
}

function getConsolidationTruckDescription(totalVolume) {
  if (totalVolume <= TRUCK_CAPACITIES.DABBABA) {
    return 'a Dabbaba truck';
  } else if (totalVolume <= TRUCK_CAPACITIES.NKR) {
    return 'a NKR truck';
  } else if (totalVolume <= TRUCK_CAPACITIES.JUMBO_4M) {
    return 'a Jumbo 4M truck';
  } else {
    const trucks = calculateTrucks(totalVolume);
    const parts = [];
    if (trucks.jumbo4m > 0) parts.push(`${trucks.jumbo4m} Jumbo 4M`);
    if (trucks.nkr > 0) parts.push(`${trucks.nkr} NKR`);
    if (trucks.dabbaba > 0) parts.push(`${trucks.dabbaba} Dabbaba`);
    const totalCount = trucks.jumbo4m + trucks.nkr + trucks.dabbaba;
    return `${parts.join(' and ')} ${totalCount > 1 ? 'trucks' : 'truck'}`;
  }
}

function getConsolidationSuggestions(orders) {
  const suggestions = [];
  const zoneGroups = {};

  // Group by zone
  orders.forEach(order => {
    if (order.totalCbm < TRUCK_CAPACITIES.DABBABA) {
      const zone = order.zone || 'Unspecified Zone';
      if (!zoneGroups[zone]) {
        zoneGroups[zone] = [];
      }
      zoneGroups[zone].push(order);
    }
  });

  for (const [zone, smallOrders] of Object.entries(zoneGroups)) {
    if (smallOrders.length > 1) {
      const branchNames = smallOrders.map(o => o.branchName).join(' and ');
      const totalVolume = smallOrders.reduce((sum, o) => sum + (o.totalCbm || 0), 0);
      const truckDescription = getConsolidationTruckDescription(totalVolume);
      suggestions.push(`Alert: Branch(es) ${branchNames} in ${zone} have a total volume that can be consolidated in ${truckDescription}.`);
    }
  }

  return suggestions;
}

module.exports = {
  calculateTrucks,
  getConsolidationSuggestions
};
