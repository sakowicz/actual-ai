import type { RuleEntity } from '@actual-app/core/src/types/models';
import type { APICategoryEntity } from '@actual-app/core/src/server/api-models';
import { transformRulesToDescriptions } from '../src/utils/rule-utils';

const baseRule = (
  actions: RuleEntity['actions'],
  overrides: Partial<RuleEntity> = {},
): RuleEntity => ({
  id: overrides.id ?? 'rule-1',
  stage: null,
  conditionsOp: 'and',
  conditions: [],
  actions,
  ...overrides,
});

const groceries: APICategoryEntity = {
  id: 'cat-groceries',
  name: 'Groceries',
  group_id: 'group-1',
};

describe('transformRulesToDescriptions', () => {
  it('renders a rule that sets a real category with that category name', () => {
    const rules = [baseRule([{
      op: 'set', field: 'category', value: groceries.id, type: 'id',
    }])];

    const result = transformRulesToDescriptions(rules, [groceries]);

    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe('Groceries');
    expect(result[0].categoryId).toBe(groceries.id);
  });

  it('keeps rules that set the category to nothing and labels them "leave uncategorized"', () => {
    const rules = [baseRule([{
      op: 'set', field: 'category', value: '', type: 'id',
    }])];

    const result = transformRulesToDescriptions(rules, [groceries]);

    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe('leave uncategorized');
    expect(result[0].categoryId).toBe('');
  });

  it('falls back to "unknown" when the rule points at a category that no longer exists', () => {
    const rules = [baseRule([{
      op: 'set', field: 'category', value: 'cat-deleted', type: 'id',
    }])];

    const result = transformRulesToDescriptions(rules, [groceries]);

    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe('unknown');
    expect(result[0].categoryId).toBe('cat-deleted');
  });

  it('excludes rules with no category-set action (e.g. payee renames)', () => {
    const rules = [baseRule([{
      op: 'set', field: 'payee', value: 'payee-1', type: 'id',
    }])];

    const result = transformRulesToDescriptions(rules, [groceries]);

    expect(result).toHaveLength(0);
  });

  it('keeps a "set to nothing" rule alongside a payee-rename rule', () => {
    const rules = [
      baseRule([{
        op: 'set', field: 'payee', value: 'payee-1', type: 'id',
      }], { id: 'rename' }),
      baseRule([{
        op: 'set', field: 'category', value: '', type: 'id',
      }], { id: 'leave-uncat' }),
    ];

    const result = transformRulesToDescriptions(rules, [groceries]);

    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe('leave uncategorized');
  });
});
