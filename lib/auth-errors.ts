export const GENERIC_SIGNUP_ERROR = "Não foi possível concluir. Verifique os dados e tente novamente.";

/**
 * Motivo do cadastro recusado pelo Supabase Auth, em português. Só mostra motivos que não revelam se o
 * e-mail já tem conta (limite de envio, senha fraca, e-mail inválido, cadastro desligado); qualquer outro
 * erro, inclusive "e-mail já cadastrado", vira a mensagem genérica (docs/SECURITY_AUDIT.md, achado S9).
 */
export function signUpErrorMessage(error: { code?: string; status?: number }): string {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
    return "Muitos cadastros ou e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.";
  }
  if (error.code === "weak_password") {
    return "Senha fraca. Use uma senha mais difícil de adivinhar, misturando letras, números e símbolos.";
  }
  if (error.code === "email_address_invalid") {
    return "Este e-mail não foi aceito. Confira se está escrito corretamente.";
  }
  if (error.code === "signup_disabled") {
    return "O cadastro está temporariamente desativado. Fale com a G2A.";
  }
  return GENERIC_SIGNUP_ERROR;
}
