import fs from 'node:fs';
import { ComunioClient } from './comunioClient.js';
import { createCapitalReport, formatCapitalReport, recordCapitalSnapshot } from './capitalReport.js';

const client = new ComunioClient();
try {
  const report = await createCapitalReport(client);
  if (process.argv.includes('--record')) recordCapitalSnapshot(report);
  console.log(formatCapitalReport(report));
  const index = process.argv.indexOf('--output');
  if (index >= 0) {
    const output = process.argv[index + 1];
    if (!output || output.startsWith('--')) throw new Error('Falta ruta --output.');
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  }
} catch (error) {
  console.error('[CAPITAL] No se puede generar un informe verificable:', error.message);
  process.exitCode = 1;
}
