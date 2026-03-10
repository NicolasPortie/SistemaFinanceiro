function stripCountryCode(digits: string): string {
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2);
  }

  return digits;
}

export function getPhoneDigits(value: string): string {
  return stripCountryCode(value.replace(/\D/g, "")).slice(0, 11);
}

export function hasValidPhoneDigits(value: string): boolean {
  const digits = getPhoneDigits(value);
  return digits.length >= 10 && digits.length <= 11;
}

export function formatPhoneInput(value: string): string {
  const digits = getPhoneDigits(value);

  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
