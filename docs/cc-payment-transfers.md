# Credit-Card Payment Transfer Finder

`actual-ai` includes a helper CLI that finds likely debit-account -> credit-card payment pairs and links them as Actual transfers.

## Safety defaults

- Dry run by default (no budget changes).
- Conservative matching focused on precision.
- Apply mode requires explicit pair selection (`--pair`) or bounded batch (`--limit N`).

## Usage

```bash
# Dry run
npm run find-cc-payments

# List account IDs for explicit CC targeting
npm run find-cc-payments -- --list-accounts

# Dry run with stricter targeting
npm run find-cc-payments -- --cc-account <account-id> --window 7 --min-score 0.9

# Apply exactly one reviewed pair
npm run find-cc-payments -- --apply --pair <outflow-id>,<inflow-id>

# Apply first N reviewed candidates
npm run find-cc-payments -- --apply --limit 5 --cc-account <account-id>
```

## Notes

- By default, the matcher infers card accounts by account name (e.g. `Visa`, `Mastercard`, `Amex`, `Credit`).
- If your account names are unusual, use `--cc-account` or `--cc-account-name-regex`.
- If either transaction is already linked as a transfer, the tool will not relink it.
