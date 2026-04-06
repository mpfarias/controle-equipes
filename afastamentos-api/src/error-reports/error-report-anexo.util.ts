import { BadRequestException } from '@nestjs/common';

const MIME_PERMITIDOS = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024; // 8 MB decodificado (aprox.)

/**
 * Valida data URL de anexo (imagem ou PDF) e retorna o tamanho estimado em bytes.
 * Lança BadRequestException se inválido.
 */
export function validarAnexoDataUrl(dataUrl: string | null | undefined): void {
  if (dataUrl == null || dataUrl === '') return;
  if (typeof dataUrl !== 'string') {
    throw new BadRequestException('Anexo inválido.');
  }
  const s = dataUrl.trim();
  if (s.length > 12_000_000) {
    throw new BadRequestException('Arquivo muito grande. Máximo 8 MB.');
  }
  const m = /^data:([\w/+.-]+);base64,(.*)$/s.exec(s);
  if (!m) {
    throw new BadRequestException('Formato de anexo inválido. Envie uma imagem ou PDF.');
  }
  const mime = m[1].toLowerCase().split(';')[0].trim();
  if (!MIME_PERMITIDOS.has(mime)) {
    throw new BadRequestException(
      'Tipo de arquivo não permitido. Use imagem (PNG, JPEG, WebP, GIF) ou PDF.',
    );
  }
  const b64 = m[2].replace(/\s/g, '');
  const tamanhoAprox = Math.ceil((b64.length * 3) / 4);
  if (tamanhoAprox > TAMANHO_MAXIMO_BYTES) {
    throw new BadRequestException('Arquivo muito grande. Máximo 8 MB.');
  }
}

export function normalizarAnexoNome(nome: string | null | undefined): string | null {
  if (nome == null || nome === '') return null;
  const n = nome.trim().slice(0, 255);
  if (!n) return null;
  return n.replace(/[/\\]/g, '_');
}
