import * as handlebars from 'handlebars';

// Register the 'eq' helper for equality comparison
handlebars.registerHelper('eq', (arg1, arg2) => arg1 === arg2);

// Register the 'incIndex' helper for incrementing index
handlebars.registerHelper('incIndex', (index: number) => index + 1);

export default handlebars;
