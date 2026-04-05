export type APIAccountEntity = {
  id: string;
  name: string;
  offbudget?: boolean;
  closed?: boolean;
  balance_current?: number | null;
};

export type APICategoryEntity = {
  id: string;
  name: string;
  group_id: string;
  is_income?: boolean;
  hidden?: boolean;
};

export type APICategoryGroupEntity = {
  id: string;
  name: string;
  is_income?: boolean;
  hidden?: boolean;
  categories?: APICategoryEntity[];
};

export type APIPayeeEntity = {
  id: string;
  name: string;
  transfer_acct?: string;
};
