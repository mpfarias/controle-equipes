import { readFileSync } from 'fs';
import { parsearLinhasTabelaAfastamentosPdf } from '../src/utils/afastamentosPdfImport';

const path = process.argv[2];
if (!path) {
  console.error('Usage: npx tsx scripts/testCopomPdfParse.ts <txt>');
  process.exit(1);
}
const texto = readFileSync(path, 'utf-8');
const linhas = parsearLinhasTabelaAfastamentosPdf(texto);
const atestados = linhas.filter((l) => /atestado/i.test(l.obs));
console.log('total registros:', linhas.length);
console.log('com Atestado na OBS:', atestados.length);
console.log('primeiros 3:', JSON.stringify(linhas.slice(0, 3), null, 2));
const comMatX = linhas.filter((l) => l.matriculaPdf?.toUpperCase().includes('X'));
console.log('MAT com X:', comMatX.length, comMatX.slice(0, 2).map((l) => l.matriculaPdf));
