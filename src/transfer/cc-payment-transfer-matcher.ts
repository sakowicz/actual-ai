import { TransactionEntity } from '@actual-app/api/@types/loot-core/src/types/models';
import { APIAccountEntity } from '@actual-app/api/@types/loot-core/src/server/api-models';

export type CcPaymentTransferCandidate = {
  outflow: TransactionEntity;
  inflow: TransactionEntity;
  score: number; // 0..1
  reasons: string[];
};

export type CcPaymentMatcherOptions = {
  windowDays: number;
  minScore: number;
  // If provided, treat these accounts as credit card accounts (exact ids).
  creditCardAccountIds?: string[];
  // If provided, treat matching account names as credit card accounts.
  creditCardAccountNameRegex?: RegExp;
};

function normalizeText(input: string | null | undefined): string {
  return (input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9*#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsToken(text: string, token: string): boolean {
  if (!token) return false;
  const t = token.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t) return false;
  const re = new RegExp(`(?:^|\\s)${t}(?:\\s|$)`);
  return re.test(text);
}

function isLikelyCreditCardAccountName(name: string): boolean {
  const n = name.toLowerCase();
  return /\b(visa|mastercard|amex|credit)\b/.test(n) || /\b(card|cc)\b/.test(n);
}

function getSpecificAccountTokens(name: string): string[] {
  // Keep tokens that identify the specific card; drop generic card words.
  const stop = new Set([
    'visa',
    'mastercard',
    'amex',
    'credit',
    'card',
    'rewards',
    'cashback',
    'account',
    'accounts',
    // Too generic to identify a specific card/account.
    'ca',
    'com',
    'inc',
    'ltd',
    'corp',
    'us',
  ]);
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !stop.has(t))
    // Keep common 2-letter bank/card identifiers (td, pc).
    .filter((t) => t.length >= 2);
}

function isLikelyCreditCardAccount(
  accountId: string,
  accountsById: Map<string, APIAccountEntity>,
  opts: CcPaymentMatcherOptions,
): boolean {
  if (opts.creditCardAccountIds?.includes(accountId)) return true;
  const name = accountsById.get(accountId)?.name ?? '';
  if (opts.creditCardAccountNameRegex) {
    return opts.creditCardAccountNameRegex.test(name);
  }

  // Conservative default heuristic; intended to be high-precision.
  return isLikelyCreditCardAccountName(name);
}

function extractLast4(text: string): string | null {
  // Common patterns: "****1234", "*1234", "x1234", "ending 1234"
  const m = text.match(/(?:\*{1,4}|x{1,4}|ending)\s*(\d{4})\b/);
  return m?.[1] ?? null;
}

function looksLikeCcPaymentPayee(text: string): boolean {
  // Require both a "payment" indicator and a "card" indicator to avoid
  // matching generic "payment" processors like "PAYMENTUS".
  const hasPayment = /\b(payment|pmt|paymt)\b/.test(text);
  const hasCard = /\b(visa|mastercard|amex|credit|card|cc|m\/c)\b/.test(text);
  const looksLikePlan = /\b(payment plan|installment|plan fee)\b/.test(text);
  const looksLikeRefund = /\b(refund|reversal|chargeback)\b/.test(text);
  return hasPayment && hasCard && !looksLikePlan && !looksLikeRefund;
}

function looksLikeCcPaymentInflowPayee(text: string): boolean {
  // Inflows often look like "PAYMENT RECEIVED" without explicit card words.
  // Still require some payment intent; allow weaker match here.
  if (/\b(payment received|payment)\b/.test(text)) return true;
  return false;
}

function daysDiff(a: string, b: string): number {
  return Math.round(Math.abs(+new Date(a) - +new Date(b)) / 86400000);
}

function scorePair(
  outflow: TransactionEntity,
  inflow: TransactionEntity,
  accountsById: Map<string, APIAccountEntity>,
  ccAccountTokensById: Map<string, string[]>,
  opts: CcPaymentMatcherOptions,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (outflow.amount >= 0 || inflow.amount <= 0) return { score: 0, reasons: ['sign mismatch'] };
  if (outflow.account === inflow.account) return { score: 0, reasons: ['same account'] };
  if (outflow.transfer_id || inflow.transfer_id) return { score: 0, reasons: ['already a transfer'] };
  if (outflow.is_parent || inflow.is_parent) return { score: 0, reasons: ['split parent'] };

  // If the caller provided explicit CC account constraints, enforce them.
  if (opts.creditCardAccountIds && !opts.creditCardAccountIds.includes(inflow.account)) {
    return { score: 0, reasons: ['inflow not in requested CC accounts'] };
  }
  if (opts.creditCardAccountNameRegex) {
    const inflowAccountName = accountsById.get(inflow.account)?.name ?? '';
    if (!opts.creditCardAccountNameRegex.test(inflowAccountName)) {
      return { score: 0, reasons: ['inflow account name does not match regex'] };
    }
  }

  const absMatch = Math.abs(outflow.amount) === inflow.amount;
  if (!absMatch) return { score: 0, reasons: ['amount mismatch'] };
  reasons.push('amount exact match');

  // `payee` is an id; for matching we only trust the imported string fields.
  const outPayee = normalizeText(outflow.imported_payee ?? '');
  const inPayee = normalizeText(inflow.imported_payee ?? '');

  const dayDelta = daysDiff(outflow.date, inflow.date);
  if (dayDelta > opts.windowDays) return { score: 0, reasons: ['outside date window'] };
  reasons.push(`within ${dayDelta} day(s)`);

  // High-precision signals
  const outLooks = looksLikeCcPaymentPayee(outPayee);
  if (outLooks) reasons.push('outflow payee looks like CC payment');

  const inflowLooks = looksLikeCcPaymentInflowPayee(inPayee);
  if (inflowLooks) reasons.push('inflow payee looks like payment');

  const outLast4 = extractLast4(outPayee);
  const inLast4 = extractLast4(inPayee);
  const last4Match = outLast4 && inLast4 && outLast4 === inLast4;
  if (last4Match) reasons.push(`card last4 match (${outLast4})`);

  const inflowIsCcAcct = isLikelyCreditCardAccount(inflow.account, accountsById, opts);
  if (inflowIsCcAcct) reasons.push('inflow account looks like credit card');

  // High-precision: if the outflow payee clearly names a *different* tracked CC account,
  // don't link it to this inflow. This avoids false positives like "WALMART MC ..." pairing
  // with an unrelated Amazon Mastercard payment of the same amount.
  const outflowMentionsOtherCard = Array.from(ccAccountTokensById.entries()).some(([acctId, tokens]) => {
    if (acctId === inflow.account) return false;
    return tokens.some((tok) => containsToken(outPayee, tok));
  });
  if (outflowMentionsOtherCard) {
    return { score: 0, reasons: ['outflow payee mentions a different card/account'] };
  }

  const isExplicitTargeting = Boolean(opts.creditCardAccountIds?.length || opts.creditCardAccountNameRegex);

  // Scoring: tuned for precision > recall.
  let score = 0;
  score += 0.55; // exact amount match is the strongest requirement
  score += Math.max(0, 0.25 - dayDelta * 0.05); // 0d=0.25, 1d=0.20, 2d=0.15, ...
  if (outLooks) score += 0.15;
  if (inflowLooks) score += 0.05;
  if (inflowIsCcAcct) score += 0.10;
  if (last4Match) score += 0.20;

  // Clamp
  score = Math.max(0, Math.min(1, score));

  // Enforce minimum evidence beyond amount+date; prevents common false positives like
  // "expense posted on a credit card" matching an unrelated checking outflow with the same amount.
  const hasPaymentEvidence = outLooks || inflowLooks || last4Match;
  if (!hasPaymentEvidence) {
    return { score: 0, reasons: ['no payment evidence'] };
  }

  // If the user didn't explicitly target CC accounts, require the inflow account to look like a CC.
  if (!isExplicitTargeting && !inflowIsCcAcct) {
    return { score: 0, reasons: ['inflow account does not look like a credit card'] };
  }

  return { score, reasons };
}

export function findCcPaymentTransferCandidates(
  transactions: TransactionEntity[],
  accounts: APIAccountEntity[],
  opts: CcPaymentMatcherOptions,
): CcPaymentTransferCandidate[] {
  const accountsById = new Map(accounts.map((a) => [a.id, a]));
  const ccAccountTokensById = new Map<string, string[]>();
  accounts.forEach((a) => {
    if (!isLikelyCreditCardAccountName(a.name)) return;
    const tokens = getSpecificAccountTokens(a.name);
    if (tokens.length > 0) {
      ccAccountTokensById.set(a.id, tokens);
    }
  });

  const inflowsByAmount = new Map<number, TransactionEntity[]>();
  transactions.forEach((tx) => {
    if (tx.amount > 0 && !tx.is_parent && !tx.transfer_id) {
      const list = inflowsByAmount.get(tx.amount) ?? [];
      list.push(tx);
      inflowsByAmount.set(tx.amount, list);
    }
  });

  const candidates: CcPaymentTransferCandidate[] = [];
  transactions.forEach((outflow) => {
    if (outflow.amount >= 0 || outflow.is_parent || outflow.transfer_id) return;
    const inflows = inflowsByAmount.get(Math.abs(outflow.amount)) ?? [];
    inflows.forEach((inflow) => {
      const { score, reasons } = scorePair(outflow, inflow, accountsById, ccAccountTokensById, opts);
      if (score >= opts.minScore) {
        candidates.push({
          outflow,
          inflow,
          score,
          reasons,
        });
      }
    });
  });

  // Greedy one-to-one matching by score desc.
  candidates.sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const selected: CcPaymentTransferCandidate[] = [];
  candidates.forEach((c) => {
    if (used.has(c.outflow.id) || used.has(c.inflow.id)) return;
    used.add(c.outflow.id);
    used.add(c.inflow.id);
    selected.push(c);
  });

  // Deterministic ordering for printing/applying limits: score desc, then most recent date desc.
  selected.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDate = a.outflow.date >= a.inflow.date ? a.outflow.date : a.inflow.date;
    const bDate = b.outflow.date >= b.inflow.date ? b.outflow.date : b.inflow.date;
    if (aDate === bDate) return 0;
    return aDate < bDate ? 1 : -1;
  });

  return selected;
}
