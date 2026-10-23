import { calculateFinancialTotals } from '../services/financialLedgerService';
import { TRANSACTION_TYPE } from '../constants';

describe('Financial Ledger and Balance Calculation', () => {
  test('calculates correct current balance matching prompt specification', () => {
    // Opening balance: 0 EGP
    // Collected pledges: 1,000 EGP
    // Donations: 500 EGP
    // Collected fines: 100 EGP
    // Expenses: 300 EGP
    // Expected current balance: 1,300 EGP
    const transactions = [
      {
        type: TRANSACTION_TYPE.PLEDGE_PAYMENT,
        direction: 'income',
        amount: 1000,
      },
      {
        type: TRANSACTION_TYPE.DONATION,
        direction: 'income',
        amount: 500,
      },
      {
        type: TRANSACTION_TYPE.FINE_PAYMENT,
        direction: 'income',
        amount: 100,
      },
      {
        type: TRANSACTION_TYPE.EXPENSE,
        direction: 'expense',
        amount: 300,
      },
    ];

    const result = calculateFinancialTotals(transactions, 0);

    expect(result.totalPledges).toBe(1000);
    expect(result.totalDonations).toBe(500);
    expect(result.totalFines).toBe(100);
    expect(result.totalExpenses).toBe(300);
    expect(result.totalIncome).toBe(1600);
    expect(result.currentBalance).toBe(1300);
  });

  test('accounts for non-zero opening balance', () => {
    const transactions = [
      {
        type: TRANSACTION_TYPE.DONATION,
        direction: 'income',
        amount: 200,
      },
      {
        type: TRANSACTION_TYPE.EXPENSE,
        direction: 'expense',
        amount: 50,
      },
    ];

    const result = calculateFinancialTotals(transactions, 500);
    expect(result.openingBalance).toBe(500);
    expect(result.currentBalance).toBe(650);
  });
});
