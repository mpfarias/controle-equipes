/**
 * Aplica máscara de CPF: 000.000.000-00 (apenas dígitos, max 11).
 */
export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Retorna apenas os 11 dígitos do CPF (para envio à API).
 */
export function cpfToDigits(cpf: string): string {
  return cpf.replace(/\D/g, '').slice(0, 11);
}

/**
 * Valida CPF pelos dígitos verificadores.
 */
export function validarCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(digits[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(digits[9], 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(digits[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(digits[10], 10)) return false;
  return true;
}

/**
 * Normaliza o texto para ter apenas a primeira letra maiúscula e o restante minúsculo
 * Exemplo: "FÉRIAS" -> "Férias", "MOTORISTA DE DIA" -> "Motorista de dia"
 */
export function normalizeTextInput(value: string): string {
  if (!value) {
    return '';
  }
  
  // Converter tudo para minúsculas primeiro
  const lowercased = value.toLowerCase();
  
  // Se o texto tem pelo menos um caractere, capitalizar a primeira letra
  if (lowercased.length > 0) {
    return lowercased.charAt(0).toUpperCase() + lowercased.slice(1);
  }
  
  return lowercased;
}

/**
 * Handler para eventos de onChange que normaliza o texto automaticamente
 * Mantém a posição do cursor
 */
export function createNormalizedInputHandler(
  setValue: (value: string) => void,
) {
  return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const input = event.target;
    const cursorPosition = input.selectionStart || 0;
    const originalValue = input.value;
    
    // Normalizar o texto
    const normalized = normalizeTextInput(originalValue);
    
    // Atualizar o valor
    setValue(normalized);
    
    // Restaurar a posição do cursor após a atualização
    setTimeout(() => {
      const newCursorPosition = Math.min(cursorPosition, normalized.length);
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };
}

/**
 * Handler para eventos de onKeyDown que bloqueia CAPS LOCK e SHIFT para letras
 */
export function handleKeyDownNormalized(
  event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
): void {
  // Bloquear CAPS LOCK
  if (event.key === 'CapsLock' || event.keyCode === 20) {
    event.preventDefault();
    return;
  }
  
  // Bloquear SHIFT para letras (permitir para números, símbolos, etc)
  if (event.shiftKey && /^[a-zA-Z]$/.test(event.key)) {
    event.preventDefault();
    // Inserir a letra minúscula diretamente
    const input = event.currentTarget;
    const cursorPosition = input.selectionStart || 0;
    const selectionEnd = input.selectionEnd || cursorPosition;
    const value = input.value;
    const newValue = value.slice(0, cursorPosition) + event.key.toLowerCase() + value.slice(selectionEnd);
    const normalized = normalizeTextInput(newValue);
    
    // Atualizar o valor do input
    input.value = normalized;
    
    // Ajustar posição do cursor
    const newCursorPosition = Math.min(cursorPosition + 1, normalized.length);
    input.setSelectionRange(newCursorPosition, newCursorPosition);
    
    // Disparar evento de mudança para atualizar o estado
    const changeEvent = new Event('input', { bubbles: true });
    input.dispatchEvent(changeEvent);
  }
}
