function addMonthsUTC(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();

  // Day 0 of the next month is the last day of the target month
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfTargetMonth)));
}

function addDaysUTC(date, days) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

// Last covered day of a cycle. Always computed from the original start date,
// never from the previous due date, so month-end clamping cannot build up drift.
function renewalDueDate(startDate, termMonths, cycleNumber = 1) {
  return addDaysUTC(addMonthsUTC(startDate, termMonths * cycleNumber), -1);
}

module.exports = { addMonthsUTC, addDaysUTC, renewalDueDate };