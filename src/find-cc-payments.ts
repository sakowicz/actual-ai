import { config } from 'dotenv';
import fs from 'fs';
import ActualApiService from './actual-api-service';
import {
  budgetId,
  dataDir,
  e2ePassword,
  password,
  serverURL,
} from './config';
import { findCcPaymentTransferCandidates } from './transfer/cc-payment-transfer-matcher';
import { linkTransferPair } from './transfer/transfer-linker';

config();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    apply: false,
    listAccounts: false,
    fromDate: '' as string,
    toDate: '' as string,
    windowDays: 5,
    minScore: 0.95,
    ccAccountIds: [] as string[],
    ccAccountNameRegex: '' as string,
    tag: '#cc-payment-transfer',
    datePreference: 'outflow' as 'outflow' | 'inflow' | 'min' | 'max',
    pair: '' as string, // "outflowId,inflowId"
    limit: 0,
    force: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') {
      opts.apply = true;
    } else if (arg === '--list-accounts') {
      opts.listAccounts = true;
    } else if (arg === '--pair' && i + 1 < args.length) {
      opts.pair = args[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < args.length) {
      opts.limit = Math.max(0, parseInt(args[i + 1], 10));
      i++;
    } else if (arg === '--force') {
      opts.force = true;
    } else if (arg === '--window' && i + 1 < args.length) {
      opts.windowDays = Math.max(1, parseInt(args[i + 1], 10));
      i++;
    } else if (arg === '--from' && i + 1 < args.length) {
      opts.fromDate = args[i + 1];
      i++;
    } else if (arg === '--to' && i + 1 < args.length) {
      opts.toDate = args[i + 1];
      i++;
    } else if (arg === '--min-score' && i + 1 < args.length) {
      opts.minScore = Math.max(0, Math.min(1, parseFloat(args[i + 1])));
      i++;
    } else if (arg === '--cc-account' && i + 1 < args.length) {
      opts.ccAccountIds.push(args[i + 1]);
      i++;
    } else if (arg === '--cc-accounts' && i + 1 < args.length) {
      opts.ccAccountIds.push(...args[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
      i++;
    } else if (arg === '--cc-account-name-regex' && i + 1 < args.length) {
      opts.ccAccountNameRegex = args[i + 1];
      i++;
    } else if (arg === '--tag' && i + 1 < args.length) {
      opts.tag = args[i + 1];
      i++;
    } else if (arg === '--date' && i + 1 < args.length) {
      const v = args[i + 1] as typeof opts.datePreference;
      if (v === 'outflow' || v === 'inflow' || v === 'min' || v === 'max') {
        opts.datePreference = v;
      }
      i++;
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log('Actual Budget - Credit Card Payment Transfer Finder');
  console.log('===================================================');
  console.log(opts.apply ? 'Mode: APPLY (will modify your budget)' : 'Mode: DRY RUN (no changes)');
  console.log(`Window: ${opts.windowDays} day(s)`);
  console.log(`Min score: ${opts.minScore}`);
  if (opts.fromDate) console.log(`From: ${opts.fromDate}`);
  if (opts.toDate) console.log(`To: ${opts.toDate}`);
  if (opts.pair) console.log(`Pair: ${opts.pair}`);
  if (opts.limit) console.log(`Limit: ${opts.limit}`);
  if (opts.force) console.log('Force: true');

  const ccNameRegex = opts.ccAccountNameRegex
    ? new RegExp(opts.ccAccountNameRegex, 'i')
    : undefined;

  const actualApiClient = await import('@actual-app/api');
  const actualApiService = new ActualApiService(
    actualApiClient,
    fs,
    dataDir,
    serverURL,
    password,
    budgetId,
    e2ePassword,
    !opts.apply,
  );

  await actualApiService.initializeApi();
  try {
    const accounts = await actualApiService.getAccounts();
    if (opts.listAccounts) {
      console.log('\nAccounts:');
      accounts.forEach((a) => {
        console.log(`- ${a.name} (id=${a.id})${a.offbudget ? ' offbudget' : ''}${a.closed ? ' closed' : ''}`);
      });
      return;
    }

    const [allTransactions, payees] = await Promise.all([
      actualApiService.getTransactions(),
      actualApiService.getPayees(),
    ]);
    const transactions = allTransactions.filter((t) => {
      if (opts.fromDate && t.date < opts.fromDate) return false;
      if (opts.toDate && t.date > opts.toDate) return false;
      return true;
    });

    const accountsById = new Map(accounts.map((a) => [a.id, a.name]));

    const assertAndLink = async (outflowId: string, inflowId: string) => {
      const outflow = allTransactions.find((t) => t.id === outflowId);
      const inflow = allTransactions.find((t) => t.id === inflowId);
      if (!outflow) throw new Error(`Outflow transaction not found: ${outflowId}`);
      if (!inflow) throw new Error(`Inflow transaction not found: ${inflowId}`);
      if (outflow.transfer_id || inflow.transfer_id) throw new Error('One of the transactions is already a transfer');
      if (outflow.amount >= 0 || inflow.amount <= 0) throw new Error('Pair is not outflow->inflow');
      if (Math.abs(outflow.amount) !== inflow.amount) throw new Error('Amounts do not match');

      const inflowAccountName = accountsById.get(inflow.account) ?? '';
      const inflowLooksCc = /\b(visa|mastercard|amex|credit|card|cc)\b/i.test(inflowAccountName);
      if (
        !opts.force
        && !inflowLooksCc
        && opts.ccAccountIds.length === 0
        && !opts.ccAccountNameRegex
      ) {
        throw new Error(
          `Refusing to apply without an explicit CC account hint; re-run with --cc-account <id> or --cc-account-name-regex, or override with --force. (inflow account: "${inflowAccountName}")`,
        );
      }

      console.log(`\nLinking transfer pair: ${outflowId} -> ${inflowId}`);
      await linkTransferPair(
        actualApiService,
        outflow,
        inflow,
        payees,
        accounts,
        { tag: opts.tag, datePreference: opts.datePreference },
      );
    };

    if (opts.pair) {
      const [outflowId, inflowId] = opts.pair.split(',').map((s) => s.trim());
      if (!outflowId || !inflowId) {
        throw new Error('Invalid --pair value. Expected: --pair <outflowId>,<inflowId>');
      }
      await assertAndLink(outflowId, inflowId);
      console.log('\nDone. Linked the requested pair as a transfer.');
      return;
    }

    const candidates = findCcPaymentTransferCandidates(transactions, accounts, {
      windowDays: opts.windowDays,
      minScore: opts.minScore,
      creditCardAccountIds: opts.ccAccountIds.length > 0 ? opts.ccAccountIds : undefined,
      creditCardAccountNameRegex: ccNameRegex,
    });

    console.log(`Found ${candidates.length} high-confidence CC payment transfer candidate(s).`);

    candidates.forEach((c, idx) => {
      console.log(`\n#${idx + 1} score=${c.score.toFixed(2)} amount=${Math.abs(c.outflow.amount)}`);
      console.log(
        `  Outflow: ${c.outflow.date} - ${accountsById.get(c.outflow.account) ?? c.outflow.account}`
        + ` - ${c.outflow.imported_payee ?? 'No payee'} (id=${c.outflow.id})`,
      );
      console.log(
        `  Inflow:  ${c.inflow.date} - ${accountsById.get(c.inflow.account) ?? c.inflow.account}`
        + ` - ${c.inflow.imported_payee ?? 'No payee'} (id=${c.inflow.id})`,
      );
      console.log(`  Reasons: ${c.reasons.join(', ')}`);
    });

    if (!opts.apply) {
      console.log('\nDry run complete. Re-run with --apply to link these as transfers.');
      console.log('Tip: add --cc-account <accountId> or --cc-account-name-regex "<regex>" to tighten matching.');
      if (candidates.length > 0) {
        console.log('To apply exactly one pair, use:');
        console.log(`  npm run find-cc-payments -- --apply --pair ${candidates[0].outflow.id},${candidates[0].inflow.id}`);
      }
      return;
    }

    if (opts.limit <= 0) {
      throw new Error('Refusing to apply without an explicit selection. Use --pair <outflowId>,<inflowId> or --limit N.');
    }

    await candidates
      .slice(0, opts.limit)
      .reduce(
        (promise, candidate) => promise.then(
          () => assertAndLink(candidate.outflow.id, candidate.inflow.id),
        ),
        Promise.resolve(),
      );

    console.log('\nDone. Linked candidates as transfers.');
  } finally {
    await actualApiService.shutdownApi();
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
