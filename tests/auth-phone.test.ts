import assert from 'node:assert/strict';
import test from 'node:test';

import { getPhoneRegistrationInput } from '../lib/auth/phone-auth';

test('phone registration uses a real phone-based auth account instead of a synthetic email account', () => {
  const params = getPhoneRegistrationInput({
    normalizedPhone: '+22222123456',
    fullName: 'Test User',
    password: 'StrongPass123!',
  });

  assert.equal(params.phone, '+22222123456');
  assert.equal(params.password, 'StrongPass123!');
  assert.equal(params.phone_confirm, true);
  assert.equal(params.email, undefined);
  assert.deepEqual(params.user_metadata, {
    full_name: 'Test User',
    phone: '+22222123456',
  });
});
