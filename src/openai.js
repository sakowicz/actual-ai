const OpenAI = require('openai');

const openai = new OpenAI({});

async function askOpenai(prompt) {
  const response = await openai.completions.create({
    model: 'gpt-3.5-turbo-instruct',
    prompt,
    temperature: 0.1,
  });

  let guess = response.choices[0].text;
  guess = guess.replace(/(\r\n|\n|\r)/gm, '');

  return guess;
}

module.exports = {
  askOpenai,
};
