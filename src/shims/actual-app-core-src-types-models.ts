export type CategoryEntity = {
  id: string;
  name: string;
  is_income?: boolean;
  group: string;
  goal_def?: string;
  sort_order?: number;
  tombstone?: boolean;
  hidden?: boolean;
};

export type CategoryGroupEntity = {
  id: string;
  name: string;
  is_income?: boolean;
  hidden?: boolean;
  sort_order?: number;
  tombstone?: boolean;
  categories?: CategoryEntity[];
};

export type TransactionEntity = {
  id: string;
  is_parent?: boolean;
  is_child?: boolean;
  parent_id?: string;
  account: string;
  category?: string;
  amount: number;
  payee?: string | null;
  notes?: string;
  date: string;
  imported_id?: string;
  imported_payee?: string;
  starting_balance_flag?: boolean;
  transfer_id?: string;
  sort_order?: number;
  cleared?: boolean;
  reconciled?: boolean;
  tombstone?: boolean;
  schedule?: string;
  subtransactions?: TransactionEntity[];
  error?: {
    type: 'SplitTransactionError';
    version: 1;
    difference: number;
  } | null;
};

export type NewRuleEntity = {
  stage: 'pre' | null | 'post';
  conditionsOp: 'or' | 'and';
  conditions: RuleConditionEntity[];
  actions: RuleActionEntity[];
  tombstone?: boolean;
};

export type RuleEntity = {
  id: string;
} & NewRuleEntity;

export type FieldValueTypes = {
  account: string;
  amount: number;
  category: string;
  category_group: string;
  date: string;
  notes: string;
  payee: string;
  payee_name: string;
  imported_payee: string;
  saved: string;
  transfer: boolean;
  parent: boolean;
  cleared: boolean;
  reconciled: boolean;
};

type RuleConditionOp =
  | 'is'
  | 'isNot'
  | 'isapprox'
  | 'isbetween'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'doesNotContain'
  | 'matches'
  | 'oneOf'
  | 'notOneOf';

export type RuleConditionEntity = {
  field: string;
  op: RuleConditionOp;
  value: string | string[];
  options?: {
    inflow?: boolean;
    outflow?: boolean;
    month?: boolean;
    year?: boolean;
  };
  conditionsOp?: 'and' | 'or';
  type?: 'id' | 'boolean' | 'date' | 'number' | 'string';
  customName?: string;
  queryFilter?: Record<string, { $oneof: string[] }>;
};

export type SetRuleActionEntity = {
  field: string;
  op: 'set';
  value: unknown;
  options?: {
    template?: string;
    formula?: string;
    splitIndex?: number;
  };
  type?: string;
};

export type SetSplitAmountRuleActionEntity = {
  op: 'set-split-amount';
  value: number | null;
  options?: {
    splitIndex?: number;
    method: 'fixed-amount' | 'fixed-percent' | 'formula' | 'remainder';
    formula?: string;
  };
};

export type LinkScheduleRuleActionEntity = {
  op: 'link-schedule';
  value: { id: string };
};

export type PrependNoteRuleActionEntity = {
  op: 'prepend-notes';
  value: string;
};

export type AppendNoteRuleActionEntity = {
  op: 'append-notes';
  value: string;
};

export type DeleteTransactionRuleActionEntity = {
  op: 'delete-transaction';
  value: string;
};

export type RuleActionEntity =
  | SetRuleActionEntity
  | SetSplitAmountRuleActionEntity
  | LinkScheduleRuleActionEntity
  | PrependNoteRuleActionEntity
  | AppendNoteRuleActionEntity
  | DeleteTransactionRuleActionEntity;
