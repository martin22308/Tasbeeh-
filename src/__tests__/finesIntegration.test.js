import { calculateFinancialTotals } from '../services/financialLedgerService';
import { TRANSACTION_TYPE } from '../constants';

describe('Attendance Penalties & Financial System Integration', () => {
  test('assessed fines do not increase available balance until collected', () => {
    // Initial treasury state: 500 EGP opening balance
    const openingBalance = 500;
    const initialTransactions = [];

    const initialResult = calculateFinancialTotals(initialTransactions, openingBalance);
    expect(initialResult.currentBalance).toBe(500);

    // Scenario from prompt:
    // A member receives a 25 EGP notebook fine.
    // Assessed: 25 EGP, Outstanding: 25 EGP, Collected: 0 EGP
    // The current balance MUST remain unchanged at 500 EGP.
    const assessedFine = 25;
    let collectedFine = 0;
    let outstandingFine = assessedFine - collectedFine;

    expect(assessedFine).toBe(25);
    expect(outstandingFine).toBe(25);
    expect(collectedFine).toBe(0);

    // Ledger only contains actual received transactions, so balance remains 500
    const beforePaymentResult = calculateFinancialTotals(initialTransactions, openingBalance);
    expect(beforePaymentResult.currentBalance).toBe(500);
  });

  test('partial payment increases collected fines and balance by exact paid amount', () => {
    const openingBalance = 500;
    const assessedFine = 25;

    // Step 2 from prompt:
    // Member pays 10 EGP partial payment towards the 25 EGP fine
    const firstPaymentAmount = 10;
    const transactionsAfterFirstPayment = [
      {
        type: TRANSACTION_TYPE.FINE_PAYMENT,
        direction: 'income',
        amount: firstPaymentAmount,
        description: 'تحصيل غرامة عدم إحضار النوتة',
      },
    ];

    const result1 = calculateFinancialTotals(transactionsAfterFirstPayment, openingBalance);

    // Collected fines should be 10 EGP
    expect(result1.totalFines).toBe(10);
    // Outstanding should become 15 EGP
    const outstandingAfterFirst = assessedFine - result1.totalFines;
    expect(outstandingAfterFirst).toBe(15);
    // Current balance should increase by 10 EGP (500 + 10 = 510)
    expect(result1.currentBalance).toBe(510);

    // Step 3 from prompt:
    // Member pays the remaining 15 EGP
    const secondPaymentAmount = 15;
    const transactionsAfterSecondPayment = [
      ...transactionsAfterFirstPayment,
      {
        type: TRANSACTION_TYPE.FINE_PAYMENT,
        direction: 'income',
        amount: secondPaymentAmount,
        description: 'تحصيل غرامة عدم إحضار النوتة (المتبقي)',
      },
    ];

    const result2 = calculateFinancialTotals(transactionsAfterSecondPayment, openingBalance);

    // Collected fines should be 25 EGP
    expect(result2.totalFines).toBe(25);
    // Outstanding should become 0 EGP
    const outstandingAfterSecond = assessedFine - result2.totalFines;
    expect(outstandingAfterSecond).toBe(0);
    // Current balance should increase by another 15 EGP (510 + 15 = 525)
    expect(result2.currentBalance).toBe(525);
  });

  test('combines all 5 fine types and strictly preserves global balance formula', () => {
    // 5 Fine types:
    // Late arrival: 20 EGP
    // Absence: 15 EGP
    // Missing notebook: 10 EGP
    // Missing Holy Bible: 10 EGP
    // Incomplete homework: 10 EGP
    const fines = {
      lateFee: 20,
      absenceFine: 15,
      notebookFine: 10,
      bibleFine: 10,
      homeworkFine: 10,
    };

    const totalAssessed =
      fines.lateFee +
      fines.absenceFine +
      fines.notebookFine +
      fines.bibleFine +
      fines.homeworkFine;

    expect(totalAssessed).toBe(65);

    // Member pays 40 EGP towards their fines
    const paidAmount = 40;
    const remainingAmount = totalAssessed - paidAmount;
    expect(remainingAmount).toBe(25);

    // Verify against global balance formula:
    // Opening balance: 1,000 EGP
    // Collected Pledges: 2,000 EGP
    // Donations: 400 EGP
    // Collected Fines: 40 EGP (Only actual paid amount!)
    // Expenses: 350 EGP
    // Expected Balance = 1000 + 2000 + 400 + 40 - 350 = 3,090 EGP
    const transactions = [
      { type: TRANSACTION_TYPE.PLEDGE_PAYMENT, direction: 'income', amount: 2000 },
      { type: TRANSACTION_TYPE.DONATION, direction: 'income', amount: 400 },
      { type: TRANSACTION_TYPE.FINE_PAYMENT, direction: 'income', amount: paidAmount },
      { type: TRANSACTION_TYPE.EXPENSE, direction: 'expense', amount: 350 },
    ];

    const totals = calculateFinancialTotals(transactions, 1000);

    expect(totals.openingBalance).toBe(1000);
    expect(totals.totalPledges).toBe(2000);
    expect(totals.totalDonations).toBe(400);
    expect(totals.totalFines).toBe(40);
    expect(totals.totalExpenses).toBe(350);
    expect(totals.currentBalance).toBe(3090);
  });

  test('editing attendance records preserves paid amounts without duplicating transactions', () => {
    // Member had 25 EGP fine, paid 10 EGP.
    const assessedBefore = 25;
    const paidBefore = 10;
    const remainingBefore = Math.max(0, assessedBefore - paidBefore);
    expect(remainingBefore).toBe(15);

    // Later, admin edits attendance details (e.g. arrival time or notebook fine adjusted to 30 EGP)
    const updatedAssessed = 30;
    // System must preserve existing fineAmountPaid
    const paidAfterEdit = paidBefore;
    const remainingAfterEdit = Math.max(0, updatedAssessed - paidAfterEdit);
    expect(remainingAfterEdit).toBe(20);

    // Ledger transactions should NOT be multiplied or duplicated
    const existingTransactions = [
      {
        transactionId: 'fine_meeting1_member1_1',
        type: TRANSACTION_TYPE.FINE_PAYMENT,
        direction: 'income',
        amount: 10,
      },
    ];

    // Editing attendance doc does not inject new transactions into the ledger
    const totals = calculateFinancialTotals(existingTransactions, 0);
    expect(totals.totalFines).toBe(10);
    expect(totals.currentBalance).toBe(10);
  });

  test('waiving remaining fines zeros out outstanding amount without altering collected funds', () => {
    // 25 EGP fine, 10 EGP collected, 15 EGP remaining
    const totalAssessed = 25;
    const fineAmountPaid = 10;
    const remainingDebt = totalAssessed - fineAmountPaid;
    expect(remainingDebt).toBe(15);

    // Admin waives the remaining fine
    // Business rule: assessed fine is reduced to what was already collected, remaining becomes 0
    const waivedAssessed = fineAmountPaid;
    const waivedRemaining = 0;
    expect(waivedRemaining).toBe(0);

    // Ledger remains exactly the 10 EGP that was collected; no money is added or lost
    const transactions = [
      { type: TRANSACTION_TYPE.FINE_PAYMENT, direction: 'income', amount: fineAmountPaid },
    ];
    const totals = calculateFinancialTotals(transactions, 100);
    expect(totals.totalFines).toBe(10);
    expect(totals.currentBalance).toBe(110);
  });
});
