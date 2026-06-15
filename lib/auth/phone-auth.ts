export function normalizeMauritaniaPhone(input: string): string {
  if (typeof input !== "string") {
    throw new Error("Phone input must be a string");
  }

  // Reject invalid characters: allow only digits, spaces, dashes, parentheses, and optional leading plus
  if (!/^\+?[0-9\s\-()]+$/.test(input)) {
    throw new Error("Phone number contains invalid characters");
  }

  // Remove spaces, dashes, parentheses
  const digits = input.replace(/[\s\-()]/g, "");

  // Now digits can contain a leading plus
  const hasPlus = digits.startsWith("+");
  const cleanDigits = hasPlus ? digits.slice(1) : digits;

  // Verify that cleanDigits only contains numbers
  if (!/^\d+$/.test(cleanDigits)) {
    throw new Error("Phone number contains invalid characters");
  }

  // Mauritania phone numbers have 8 digits locally, or 11 digits with country code 222, or 13 digits with 00222
  if (cleanDigits.length === 8) {
    return `+222${cleanDigits}`;
  } else if (cleanDigits.length === 11 && cleanDigits.startsWith("222")) {
    return `+${cleanDigits}`;
  } else if (cleanDigits.length === 13 && cleanDigits.startsWith("00222")) {
    return `+${cleanDigits.slice(2)}`;
  } else {
    throw new Error("Invalid phone number length");
  }
}

export function toSyntheticPhoneEmail(normalizedPhone: string): string {
  if (!normalizedPhone.startsWith("+222") || normalizedPhone.length !== 12) {
    throw new Error("Invalid normalized phone number");
  }
  const digits = normalizedPhone.slice(1); // strip the leading '+'
  return `${digits}@phone.indb.local`;
}

export function getPhoneRegistrationInput({
  normalizedPhone,
  fullName,
  password,
}: {
  normalizedPhone: string;
  fullName: string;
  password: string;
}) {
  return {
    phone: normalizedPhone,
    password,
    phone_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: normalizedPhone,
    },
  };
}

export function getSyntheticPhoneRegistrationInput({
  normalizedPhone,
  fullName,
  password,
}: {
  normalizedPhone: string;
  fullName: string;
  password: string;
}) {
  return {
    ...getPhoneRegistrationInput({ normalizedPhone, fullName, password }),
    email: toSyntheticPhoneEmail(normalizedPhone),
    email_confirm: true,
  };
}
