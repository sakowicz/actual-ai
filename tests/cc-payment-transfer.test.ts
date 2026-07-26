/*
 * These tests intentionally use compact fixture objects for external API entity types.
 * Building fully-typed entities here would add a lot of unrelated boilerplate and
 * make matcher/linker behavior harder to review.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { findCcPaymentTransferCandidates } from '../src/transfer/cc-payment-transfer-matcher';
import { buildTransferLinkPlan } from '../src/transfer/transfer-linker';

function tx(overrides: Partial<any>) {
  return {
    id: 't',
    account: 'a',
    amount: 0,
    date: '2025-01-01',
    imported_payee: null,
    payee: null,
    notes: null,
    transfer_id: null,
    is_parent: false,
    ...overrides,
  };
}

describe('CC payment transfer matching', () => {
  test('matches a typical debit -> credit card payment', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'cc', name: 'Visa Card' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -12345,
      date: '2025-01-10',
      imported_payee: 'ONLINE PAYMENT VISA ****1234',
    });
    const inflow = tx({
      id: 'i1',
      account: 'cc',
      amount: 12345,
      date: '2025-01-11',
      imported_payee: 'PAYMENT RECEIVED',
    });

    const candidates = findCcPaymentTransferCandidates([outflow, inflow] as any, accounts as any, {
      windowDays: 5,
      minScore: 0.95,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].outflow.id).toBe('o1');
    expect(candidates[0].inflow.id).toBe('i1');
    expect(candidates[0].score).toBeGreaterThanOrEqual(0.95);
  });

  test('does not match generic bank transfers without CC evidence', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'savings', name: 'Savings' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -50000,
      date: '2025-01-10',
      imported_payee: 'TRANSFER TO SAVINGS',
    });
    const inflow = tx({
      id: 'i1',
      account: 'savings',
      amount: 50000,
      date: '2025-01-10',
      imported_payee: 'TRANSFER FROM CHECKING',
    });

    const candidates = findCcPaymentTransferCandidates([outflow, inflow] as any, accounts as any, {
      windowDays: 3,
      minScore: 0.5,
    });

    expect(candidates).toHaveLength(0);
  });

  test('avoids false positives on payment processors that are not credit cards', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'utilities', name: 'Utilities' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -7500,
      date: '2025-01-10',
      imported_payee: 'PAYMENTUS.COM CITY UTILITIES',
    });
    const inflow = tx({
      id: 'i1',
      account: 'utilities',
      amount: 7500,
      date: '2025-01-10',
      imported_payee: 'PAYMENT RECEIVED',
    });

    const candidates = findCcPaymentTransferCandidates([outflow, inflow] as any, accounts as any, {
      windowDays: 3,
      minScore: 0.1,
    });

    expect(candidates).toHaveLength(0);
  });

  test('avoids outflow payees that mention a different tracked card/account', () => {
    const accounts = [
      { id: 'td-visa', name: 'TD GREEN VISA' },
      { id: 'walmart', name: 'Walmart Rewards Mastercard' },
      { id: 'checking', name: 'Checking' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -10000,
      date: '2025-01-10',
      imported_payee: 'WALMART MC XW#010',
    });
    const inflow = tx({
      id: 'i1',
      account: 'td-visa',
      amount: 10000,
      date: '2025-01-10',
      imported_payee: 'PAYMENT - THANK YOU',
    });

    const candidates = findCcPaymentTransferCandidates([outflow, inflow] as any, accounts as any, {
      windowDays: 5,
      minScore: 0.01,
    });

    expect(candidates).toHaveLength(0);
  });

  test('still matches issuer-style outflows that do not name a specific tracked card', () => {
    const accounts = [
      { id: 'amazon', name: 'Amazon.ca Rewards Mastercard' },
      { id: 'walmart', name: 'Walmart Rewards Mastercard' },
      { id: 'checking', name: 'Checking' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -30000,
      date: '2025-01-10',
      imported_payee: 'MBNA Canada MasterCard',
    });
    const inflow = tx({
      id: 'i1',
      account: 'amazon',
      amount: 30000,
      date: '2025-01-11',
      imported_payee: 'PAYMENT',
    });

    const candidates = findCcPaymentTransferCandidates([outflow, inflow] as any, accounts as any, {
      windowDays: 5,
      minScore: 0.7,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].outflow.id).toBe('o1');
    expect(candidates[0].inflow.id).toBe('i1');
  });

  test('prefers closest date when multiple inflows exist', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'cc', name: 'Mastercard' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -20000,
      date: '2025-01-10',
      imported_payee: 'ONLINE PAYMENT MASTERCARD',
    });
    const inflow1 = tx({
      id: 'i1',
      account: 'cc',
      amount: 20000,
      date: '2025-01-11',
      imported_payee: 'PAYMENT RECEIVED',
    });
    const inflow2 = tx({
      id: 'i2',
      account: 'cc',
      amount: 20000,
      date: '2025-01-15',
      imported_payee: 'PAYMENT RECEIVED',
    });

    const candidates = findCcPaymentTransferCandidates(
      [outflow, inflow2, inflow1] as any,
      accounts as any,
      {
        windowDays: 10,
        minScore: 0.9,
      },
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].inflow.id).toBe('i1');
  });

  test('does not match unrelated expense posted on a credit card', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'cc', name: 'Amazon.ca Rewards Mastercard' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -18000,
      date: '2025-01-10',
      imported_payee: 'GROUNDED PSYCHO',
    });
    const inflow = tx({
      id: 'i1',
      account: 'cc',
      amount: 18000,
      date: '2025-01-10',
      imported_payee: 'BIRTHDAY LASERTAG',
    });

    const candidates = findCcPaymentTransferCandidates([outflow, inflow] as any, accounts as any, {
      windowDays: 3,
      minScore: 0.1,
    });

    expect(candidates).toHaveLength(0);
  });

  test('does not match a same-account payment-plan reversal on a card', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'cc', name: 'Amazon Rewards Mastercard' },
    ] as any;
    const checkingPayment = tx({
      id: 'checking-payment',
      account: 'checking',
      amount: -19000,
      date: '2025-01-10',
      imported_payee: 'MBNA M/C PAYMENT',
    });
    const planCharge = tx({
      id: 'plan-charge',
      account: 'cc',
      amount: -19000,
      date: '2025-01-10',
      imported_payee: 'Couples Therapy payment plan',
    });
    const planReversal = tx({
      id: 'plan-reversal',
      account: 'cc',
      amount: 19000,
      date: '2025-01-10',
      imported_payee: 'Couples Therapy payment plan',
    });

    const candidates = findCcPaymentTransferCandidates(
      [checkingPayment, planCharge, planReversal] as any,
      accounts,
      { windowDays: 3, minScore: 0.1 },
    );

    expect(candidates).toHaveLength(0);
  });
});

describe('transfer link plan', () => {
  test('buildTransferLinkPlan merges notes and sets payees/transfer_id for both sides', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'cc', name: 'Visa' },
    ] as any;

    const payees = [
      { id: 'p-checking', name: 'Transfer: Checking', transfer_acct: 'checking' },
      { id: 'p-cc', name: 'Transfer: Visa', transfer_acct: 'cc' },
    ] as any;

    const outflow = tx({
      id: 'o1',
      account: 'checking',
      amount: -123,
      date: '2025-01-10',
      notes: 'bank ref 111',
    });
    const inflow = tx({
      id: 'i1',
      account: 'cc',
      amount: 123,
      date: '2025-01-11',
      notes: 'posted next day',
    });

    const plan = buildTransferLinkPlan(
      outflow as any,
      inflow as any,
      payees as any,
      accounts as any,
      {
        tag: '#cc-payment-transfer',
        datePreference: 'outflow',
      },
    );

    expect(plan.outflowUpdate.payee).toBe('p-cc');
    expect(plan.outflowUpdate.transfer_id).toBe('i1');
    expect(plan.inflowUpdate.payee).toBe('p-checking');
    expect(plan.inflowUpdate.transfer_id).toBe('o1');
    expect(plan.outflowUpdate.date).toBe('2025-01-10');
    expect(plan.outflowUpdate.notes).toContain('bank ref 111');
    expect(plan.outflowUpdate.notes).toContain('posted next day');
    expect(plan.outflowUpdate.notes).toContain('#cc-payment-transfer');
  });

  test('rejects a pair that cannot be represented as an Actual transfer', () => {
    const accounts = [
      { id: 'checking', name: 'Checking' },
      { id: 'cc', name: 'Visa' },
    ] as any;
    const payees = [
      { id: 'p-checking', name: 'Transfer: Checking', transfer_acct: 'checking' },
      { id: 'p-cc', name: 'Transfer: Visa', transfer_acct: 'cc' },
    ] as any;

    expect(() => buildTransferLinkPlan(
      tx({ id: 'o1', account: 'checking', amount: -100 }) as any,
      tx({ id: 'i1', account: 'cc', amount: 99 }) as any,
      payees,
      accounts,
    )).toThrow('amounts must exactly offset');
  });
});
