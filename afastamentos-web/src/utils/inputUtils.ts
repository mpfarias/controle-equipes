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
