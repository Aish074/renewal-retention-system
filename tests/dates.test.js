const { addMonthsUTC, renewalDueDate } = require('../src/utils/dates');

const iso = (date) => date.toISOString().slice(0, 10);

describe('addMonthsUTC', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2026-12-15', 3, '2027-03-15'],
    ['2026-01-01', 12, '2027-01-01'],
  ])('%s plus %i months is %s', (start, months, expected) => {
    expect(iso(addMonthsUTC(new Date(start), months))).toBe(expected);
  });
});

describe('renewalDueDate', () => {
  it.each([
    ['2026-01-01', 12, 1, '2026-12-31'],
    ['2026-01-01', 12, 2, '2027-12-31'],
    ['2026-01-01', 3, 4, '2026-12-31'],
    ['2023-03-01', 12, 1, '2024-02-29'],
    ['2026-01-31', 1, 1, '2026-02-27'],
    
    ['2026-01-31', 1, 2, '2026-03-30'],
  ])('start %s, %i-month term, cycle %i is due %s', (start, term, cycle, expected) => {
    expect(iso(renewalDueDate(new Date(start), term, cycle))).toBe(expected);
  });
});