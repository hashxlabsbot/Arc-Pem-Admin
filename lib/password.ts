export interface PasswordRule {
  id: string
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length',    label: 'At least 8 characters',         test: (pw) => pw.length >= 8 },
  { id: 'upper',     label: 'One uppercase letter (A–Z)',     test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower',     label: 'One lowercase letter (a–z)',     test: (pw) => /[a-z]/.test(pw) },
  { id: 'number',    label: 'One number (0–9)',               test: (pw) => /[0-9]/.test(pw) },
  { id: 'special',   label: 'One special character (!@#$…)',  test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

export function validatePassword(pw: string): { valid: boolean; errors: string[] } {
  const errors = PASSWORD_RULES.filter((r) => !r.test(pw)).map((r) => r.label)
  return { valid: errors.length === 0, errors }
}

export function passwordStrength(pw: string): { score: number; label: string; color: string } {
  const passed = PASSWORD_RULES.filter((r) => r.test(pw)).length
  if (passed <= 1) return { score: 1, label: 'Weak',      color: 'bg-red-500' }
  if (passed === 2) return { score: 2, label: 'Fair',      color: 'bg-orange-400' }
  if (passed === 3) return { score: 3, label: 'Good',      color: 'bg-yellow-400' }
  if (passed === 4) return { score: 4, label: 'Strong',    color: 'bg-emerald-500' }
  return                    { score: 5, label: 'Very Strong', color: 'bg-emerald-600' }
}
