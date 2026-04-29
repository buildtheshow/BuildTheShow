const assert = require('node:assert/strict');
const validator = require('../SHARED/Components/custom-url-validation.js');

const passing = [
  'wizard-of-oz',
  'les-miserables',
  'heathers',
  'rent',
  'death-becomes-her',
  'murder-for-two',
  'blood-brothers',
  'drug-store-cowboy',
  'weed-the-musical',
  'reefer-madness',
  'crime-and-punishment',
  'suicide-club',
  'top-gun',
  'war-horse',
  'hells-kitchen',
  'american-idiot',
];

for (const slug of passing) {
  assert.equal(validator.validate(slug).ok, true, `${slug} should pass`);
}

const reserved = ['admin', 'api', 'dashboard'];
for (const slug of reserved) {
  const result = validator.validate(slug);
  assert.equal(result.ok, false, `${slug} should fail`);
  assert.equal(result.message, validator.GENERIC_UNAVAILABLE_MESSAGE);
}

const malformed = [
  'wizard of oz',
  'wizard_of_oz',
  'wizard--of-oz',
  '-wizard-of-oz',
  'wizard-of-oz-',
  'ab',
  'this-custom-url-is-way-too-long-to-be-a-valid-build-the-show-url',
];

for (const slug of malformed) {
  const result = validator.validate(slug);
  assert.equal(result.ok, false, `${slug} should fail`);
  assert.equal(result.message, validator.GENERIC_UNAVAILABLE_MESSAGE);
}

const strictBlocked = [
  'fuck',
  'f-u-c-k',
  'sh1t',
  'b1tch',
  'p0rn',
  'shit',
  'bullshit',
  'porn',
  'nazi-porn',
];

for (const slug of strictBlocked) {
  const result = validator.validate(slug);
  assert.equal(result.ok, false, `${slug} should fail`);
  assert.equal(result.message, validator.GENERIC_UNAVAILABLE_MESSAGE);
}

console.log('custom-url-validation tests passed');
