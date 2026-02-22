import { APIPayeeEntity, APIAccountEntity } from '@actual-app/api/@types/loot-core/src/server/api-models';
import { TransactionEntity } from '@actual-app/api/@types/loot-core/src/types/models';
import { ActualApiServiceI } from '../types';

export type TransferLinkPlan = {
  outflowUpdate: Partial<TransactionEntity>;
  inflowUpdate: Partial<TransactionEntity>;
  chosenDate: string;
  mergedNotes?: string;
  outflowTransferPayeeId: string;
  inflowTransferPayeeId: string;
};

function normalizeNotes(notes: string | null | undefined): string {
  return (notes ?? '').trim().replace(/\s+/g, ' ');
}

function addTag(notes: string, tag: string): string {
  if (!tag) return notes;
  if (notes.includes(tag)) return notes;
  return `${notes} ${tag}`.trim();
}

function mergeNotes(a: string | null | undefined, b: string | null | undefined, tag: string): string | undefined {
  const na = normalizeNotes(a);
  const nb = normalizeNotes(b);

  let merged = '';
  if (na && nb) {
    if (na === nb) merged = na;
    else if (na.includes(nb)) merged = na;
    else if (nb.includes(na)) merged = nb;
    else merged = `${na} | ${nb}`;
  } else {
    merged = na || nb;
  }

  merged = addTag(merged, tag);
  return merged ? merged : undefined;
}

function payeeIdForTransferToAccount(payees: APIPayeeEntity[], toAccountId: string): string | null {
  return payees.find((p) => p.transfer_acct === toAccountId)?.id ?? null;
}

function accountName(accountsById: Map<string, APIAccountEntity>, id: string): string {
  return accountsById.get(id)?.name ?? id;
}

export function buildTransferLinkPlan(
  outflow: TransactionEntity,
  inflow: TransactionEntity,
  payees: APIPayeeEntity[],
  accounts: APIAccountEntity[],
  opts: { tag?: string; datePreference?: 'outflow' | 'inflow' | 'min' | 'max' } = {},
): TransferLinkPlan {
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const outflowTransferPayeeId = payeeIdForTransferToAccount(payees, inflow.account);
  if (!outflowTransferPayeeId) {
    throw new Error(`Missing transfer payee for account "${accountName(accountsById, inflow.account)}" (${inflow.account})`);
  }

  const inflowTransferPayeeId = payeeIdForTransferToAccount(payees, outflow.account);
  if (!inflowTransferPayeeId) {
    throw new Error(`Missing transfer payee for account "${accountName(accountsById, outflow.account)}" (${outflow.account})`);
  }

  const pref = opts.datePreference ?? 'outflow';
  const outDate = outflow.date;
  const inDate = inflow.date;
  let chosenDate = outDate;
  if (pref === 'inflow') chosenDate = inDate;
  if (pref === 'min') chosenDate = outDate <= inDate ? outDate : inDate;
  if (pref === 'max') chosenDate = outDate >= inDate ? outDate : inDate;

  const mergedNotes = mergeNotes(outflow.notes, inflow.notes, opts.tag ?? '');

  // NOTE: In Actual, transfer notes/dates are mirrored across both sides, so we set
  // them explicitly on both updates to preserve information.
  const outflowUpdate: Partial<TransactionEntity> = {
    payee: outflowTransferPayeeId,
    transfer_id: inflow.id,
    date: chosenDate,
    notes: mergedNotes,
  };

  const inflowUpdate: Partial<TransactionEntity> = {
    payee: inflowTransferPayeeId,
    transfer_id: outflow.id,
    date: chosenDate,
    notes: mergedNotes,
  };

  return {
    outflowUpdate,
    inflowUpdate,
    chosenDate,
    mergedNotes,
    outflowTransferPayeeId,
    inflowTransferPayeeId,
  };
}

export async function linkTransferPair(
  actualApiService: ActualApiServiceI,
  outflow: TransactionEntity,
  inflow: TransactionEntity,
  payees: APIPayeeEntity[],
  accounts: APIAccountEntity[],
  opts: { tag?: string; datePreference?: 'outflow' | 'inflow' | 'min' | 'max' } = {},
): Promise<TransferLinkPlan> {
  const plan = buildTransferLinkPlan(outflow, inflow, payees, accounts, opts);

  // Update both sides. This is required; Actual's transfer logic assumes a symmetric link.
  await actualApiService.updateTransaction(outflow.id, plan.outflowUpdate);
  await actualApiService.updateTransaction(inflow.id, plan.inflowUpdate);

  return plan;
}
