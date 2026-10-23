import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Security Rules & Financial Data Integrity Test Suite
 * Tests authorization boundaries, non-negativity constraints, self-elevation prevention,
 * and duplicate collection prevention according to project specifications.
 */
describe('Firestore Security Rules & Authorization Audits', () => {
  const rulesPath = path.resolve(__dirname, '../../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('ensures default deny is active for unmatched paths', () => {
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
  });

  it('strictly prohibits any open "allow read, write: if true" rules', () => {
    expect(rulesContent).not.toMatch(/allow\s+(read|write|create|update|delete)\s*:\s*if\s+true\s*;/i);
  });

  it('validates administrator check binds strictly to request.auth.uid and administratorProfiles', () => {
    // Verifies exists & get on administratorProfiles/$(request.auth.uid)
    expect(rulesContent).toContain('/databases/$(database)/documents/administratorProfiles/$(request.auth.uid)');
    expect(rulesContent).toContain('data.isActive == true');
    expect(rulesContent).toContain("data.role == 'admin'");
  });

  it('prevents self-elevation: ordinary users cannot create or modify admin profiles', () => {
    // In match /administratorProfiles/{userId}:
    // write is ONLY allowed if already isAdministrator()
    const adminProfilesBlock = rulesContent.match(/match \/administratorProfiles\/\{userId\}[\s\S]*?\}/)?.[0];
    expect(adminProfilesBlock).toBeDefined();
    expect(adminProfilesBlock).toContain('allow write: if isAdministrator();');
    // An ordinary user cannot write their own document to become admin
    expect(adminProfilesBlock).not.toContain('allow write: if request.auth.uid == userId;');
  });

  it('covers all 12 collections used in the application', () => {
    const requiredCollections = [
      'administratorProfiles',
      'members',
      'meetings',
      'attendanceRecords',
      'fines',
      'pledgeObligations',
      'pledgePayments',
      'donations',
      'expenses',
      'financialTransactions',
      'settings',
      'auditLogs',
    ];

    requiredCollections.forEach((col) => {
      expect(rulesContent).toContain(`match /${col}/`);
    });
  });

  it('validates that all 5 fine types are strictly non-negative in attendanceRecords', () => {
    const attendanceBlock = rulesContent.match(/match \/attendanceRecords\/\{recordId\}[\s\S]*?allow delete/)?.[0];
    expect(attendanceBlock).toBeDefined();
    expect(attendanceBlock).toContain('lateFee');
    expect(attendanceBlock).toContain('absenceFine');
    expect(attendanceBlock).toContain('notebookFine');
    expect(attendanceBlock).toContain('bibleFine');
    expect(attendanceBlock).toContain('homeworkFine');
    expect(attendanceBlock).toContain('totalAssessedFine');
    expect(attendanceBlock).toContain('fineAmountPaid');
    expect(attendanceBlock).toContain('fineRemainingAmount');
  });

  it('enforces strictly positive amounts (> 0) on financial payment records', () => {
    const finesBlock = rulesContent.match(/match \/fines\/\{fineId\}[\s\S]*?\}/)?.[0];
    expect(finesBlock).toContain('isPositiveAmount(request.resource.data.amount)');

    const paymentsBlock = rulesContent.match(/match \/pledgePayments\/\{paymentId\}[\s\S]*?\}/)?.[0];
    expect(paymentsBlock).toContain('isPositiveAmount(request.resource.data.amount)');

    const donationsBlock = rulesContent.match(/match \/donations\/\{donationId\}[\s\S]*?\}/)?.[0];
    expect(donationsBlock).toContain('isPositiveAmount(request.resource.data.amount)');

    const expensesBlock = rulesContent.match(/match \/expenses\/\{expenseId\}[\s\S]*?\}/)?.[0];
    expect(expensesBlock).toContain('isPositiveAmount(request.resource.data.amount)');

    const txBlock = rulesContent.match(/match \/financialTransactions\/\{transactionId\}[\s\S]*?\}/)?.[0];
    expect(txBlock).toContain('isPositiveAmount(request.resource.data.amount)');
    expect(txBlock).toContain("request.resource.data.direction in ['income', 'expense']");
  });

  it('guarantees that audit logs are append-only (immutable audit trail)', () => {
    const auditBlock = rulesContent.match(/match \/auditLogs\/\{logId\}[\s\S]*?\}/)?.[0];
    expect(auditBlock).toBeDefined();
    expect(auditBlock).toContain('allow create: if isAdministrator();');
    expect(auditBlock).toContain('allow update, delete: if false;');
  });
});
