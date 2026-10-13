export function nativeValidityMessage(input: HTMLInputElement): string {
  const validity = input.validity;
  if (validity.valueMissing) return "Preencha este campo.";
  if (validity.typeMismatch && input.type === "email") return "Informe um e-mail válido.";
  if (validity.tooShort) return `Mínimo de ${input.minLength} caracteres.`;
  return input.validationMessage || "Campo inválido.";
}
