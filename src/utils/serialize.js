const formatDate = (date) => (date ? date.toISOString().slice(0, 10) : null);

const formatMoney = (value) =>
  value === null || value === undefined ? null : value.toFixed(2);

module.exports = { formatDate, formatMoney };