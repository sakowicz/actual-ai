import { APIPayeeEntity, APICategoryGroupEntity } from '@actual-app/core/src/server/api-models';
import { RuleEntity, TransactionEntity } from '@actual-app/core/src/types/models';
import handlebars from './handlebars-helpers';
import {
  PromptGeneratorI,
} from './types';
import PromptTemplateException from './exceptions/prompt-template-exception';
import { isToolEnabled, isFeatureEnabled } from './config';
import { transformRulesToDescriptions } from './utils/rule-utils';

class PromptGenerator implements PromptGeneratorI {
  private readonly promptTemplate: string;

  constructor(
    promptTemplate: string,
  ) {
    this.promptTemplate = promptTemplate;
  }

  generate(
    categoryGroups: APICategoryGroupEntity[],
    transactions: TransactionEntity[],
    payees: APIPayeeEntity[],
    rules: RuleEntity[],
  ): string {
    let template;
    try {
      template = handlebars.compile(this.promptTemplate);
    } catch {
      console.error('Error generating prompt. Check syntax of your template.');
      throw new PromptTemplateException('Error generating prompt. Check syntax of your template.');
    }

    // Ensure each category group has its categories property
    const groupsWithCategories = categoryGroups.map((group) => ({
      ...group,
      groupName: group.name,
      categories: group.categories ?? [],
    }));

    const rulesDescription = transformRulesToDescriptions(
      rules,
      groupsWithCategories,
      payees,
    );

    const mappedTransactions = transactions.map(transaction => {
      const payeeName = payees.find((payee) => payee.id === transaction.payee)?.name;
      let description = transaction.notes ?? '';

      // Extract Amazon product names to simplify the prompt
      if (description.includes('#Amazon-Product-Name')) {
        const productMatch = description.match(/#Amazon-Product-Name\s+(.*?)(?=\s*#[A-Za-z-]+|$)/);
        if (productMatch) {
          description = productMatch[1].trim();
        }
      } else if (description.includes('#Amazon-Product-Name-Split-')) {
        const splitProducts = [];
        const splitRegex = /#Amazon-Product-Name-Split-\d+\s+(.*?)(?=\s*#[A-Za-z-]+|$)/g;
        let match;
        while ((match = splitRegex.exec(description)) !== null) {
          splitProducts.push(match[1].trim());
        }
        if (splitProducts.length > 0) {
          description = splitProducts.join('; ');
        }
      }

      return {
        id: transaction.id,
        amount: Math.abs(transaction.amount),
        type: transaction.amount > 0 ? 'Income' : 'Outcome',
        description: description,
        payee: payeeName || transaction.imported_payee || '',
        date: transaction.date ?? '',
        cleared: transaction.cleared,
        reconciled: transaction.reconciled,
      };
    });

    try {
      const webSearchEnabled = (typeof isToolEnabled('webSearch') === 'boolean' && isToolEnabled('webSearch'))
        || (typeof isToolEnabled('freeWebSearch') === 'boolean' && isToolEnabled('freeWebSearch'));
      
      const firstTransaction = mappedTransactions[0];

      return template({
        categoryGroups: groupsWithCategories,
        rules: rulesDescription,
        transactions: mappedTransactions,
        hasWebSearchTool: webSearchEnabled,
        suggestNewCategoriesEnabled: isFeatureEnabled('suggestNewCategories'),
        // Backward compatibility for legacy single-transaction templates
        ...(firstTransaction ? {
          amount: firstTransaction.amount,
          type: firstTransaction.type,
          description: firstTransaction.description,
          payee: firstTransaction.payee,
          date: firstTransaction.date,
          cleared: firstTransaction.cleared,
          reconciled: firstTransaction.reconciled,
        } : {}),
      });
    } catch {
      console.error('Error generating prompt. Check syntax of your template.');
      throw new PromptTemplateException('Error generating prompt. Check syntax of your template.');
    }
  }
}

export default PromptGenerator;
