const TRUCK_CAPACITIES = {
  JUMBO_4M: 21.0,
  JUMBO: 9.5,
  DABBABA: 5.0,
};

function calculateTrucks(cbm) {
  let remainingCbm = cbm;
  const trucks = {
    jumbo4m: 0,
    jumbo: 0,
    dabbaba: 0,
  };

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
      remainingCbm -= TRUCK_CAPACITIES.DABBABA;
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
