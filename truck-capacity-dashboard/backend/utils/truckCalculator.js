const Order = require('../models/OrderSummary.js');

const TRUCK_CAPACITIES = {
  JUMBO_4M: 21.0,
  JUMBO: 9.5,
  DABBABA: 5.0,
};

function calculateTrucks(cbm, branchName) {
  let remainingCbm = cbm;
  const trucks = {
    jumbo4m: 0,
    jumbo: 0,
    dabbaba: 0,
  };

  const No_Jumbo = [
    "OUT 6th of October FP #3",
    "6th of October FP #7",
    "Sheikh Zayed City FP #2",
    "Haram FP#2",
    "Garden City",
    "Maadi FP #1",
    "Maadi FP#3",
    "Maadi FP#5",
    "Al Rehab City FP #2",
    "New Cairo FP #4",
    "New Cairo FP#6",
    "New Cairo FP #7",
    "New Cairo FP #8",
    "Shorouk FP #1",
    "Shorouk FP #3",
    "Nasr City FP#3",
    "Nasr City FP#4",
    "Heliopolis FP #1",
    "Heliopolis FP #2",
    "Ein Shams FP#1",
    "Manial FP#1"
  ];

  if (No_Jumbo.includes(branchName)) {
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
    } else if (remainingCbm >= TRUCK_CAPACITIES.JUMBO) {
      trucks.jumbo += 1;
      remainingCbm -= TRUCK_CAPACITIES.JUMBO;
    } else if (remainingCbm > TRUCK_CAPACITIES.DABBABA && remainingCbm <= TRUCK_CAPACITIES.JUMBO) {
      trucks.jumbo += 1;
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
  } else if (totalVolume <= TRUCK_CAPACITIES.JUMBO) {
    return 'a Jumbo truck';
  } else if (totalVolume <= TRUCK_CAPACITIES.JUMBO_4M) {
    return 'a Jumbo 4M truck';
  } else {
    const trucks = calculateTrucks(totalVolume);
    const parts = [];
    if (trucks.jumbo4m > 0) parts.push(`${trucks.jumbo4m} Jumbo 4M`);
    if (trucks.jumbo > 0) parts.push(`${trucks.jumbo} Jumbo`);
    if (trucks.dabbaba > 0) parts.push(`${trucks.dabbaba} Dabbaba`);
    const totalCount = trucks.jumbo4m + trucks.jumbo + trucks.dabbaba;
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
