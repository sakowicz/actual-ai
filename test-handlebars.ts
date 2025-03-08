import * as fs from 'fs';
import handlebars from './src/handlebars-helpers';

// Load the template
const similarRulesTemplate = fs.readFileSync('./src/templates/similar-rules.hbs', 'utf8').trim();

// Compile the template
const template = handlebars.compile(similarRulesTemplate);

// Test data
const testData = {
  amount: 100,
  type: 'Outcome',
  description: 'Test transaction',
  importedPayee: 'Test Payee',
  payee: 'Test Payee',
  date: '2025-03-05',
  rules: [
    {
      index: 0,
      ruleName: 'Test Rule',
      categoryName: 'Test Category',
      conditions: [
        {
          field: 'payee',
          op: 'is',
          type: 'id',
          value: ['test-id-1', 'test-id-2'],
        },
        {
          field: 'notes',
          op: 'contains',
          type: 'string',
          value: 'test',
        },
      ],
    },
  ],
};

// Execute the template
try {
  const result = template(testData);
  console.log('Template rendered successfully:');
  console.log(result);
  console.log('\nHandlebars helpers are working correctly!');
} catch (error) {
  console.error('Error rendering template:', error);
}
