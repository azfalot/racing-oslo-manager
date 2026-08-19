import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', 'assets', 'signing_template.jpg');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'generated');

// Posición → emoji/etiqueta corta
const POS_LABELS = {
  keeper: { label: 'PORTERO', short: 'POR' },
  defender: { label: 'DEFENSA', short: 'DEF' },
  midfielder: { label: 'CENTROCAMPISTA', short: 'MED' },
  striker: { label: 'DELANTERO', short: 'DEL' }
};

/**
 * Genera una tarjeta de presentación de nuevo fichaje.
 * @param {string} playerName - Nombre del jugador
 * @param {string} position - 'keeper' | 'defender' | 'midfielder' | 'striker'
 * @param {number} price - Precio en euros
 * @param {number} squadNumber - Número de dorsal (opcional, 0 = sin número fijo)
 * @returns {string} - Ruta al archivo PNG generado
 */
export async function generateSigningCard(playerName, position, price, squadNumber = 0) {
  // Crear directorio de salida si no existe
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const W = 1200;
  const H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── 1. FONDO: imagen plantilla ────────────────────────────────────────────
  try {
    const template = await loadImage(TEMPLATE_PATH);
    ctx.drawImage(template, 0, 0, W, H);
  } catch (e) {
    // Fallback: fondo degradado azul marino/dorado si no carga la plantilla
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0d1b3e');
    grad.addColorStop(1, '#1a2f5a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── 2. OVERLAY oscuro en la mitad inferior para texto legible ─────────────
  const overlayGrad = ctx.createLinearGradient(0, H * 0.40, 0, H);
  overlayGrad.addColorStop(0, 'rgba(15, 30, 15, 0)');
  overlayGrad.addColorStop(0.35, 'rgba(15, 30, 15, 0.78)');
  overlayGrad.addColorStop(1, 'rgba(10, 20, 10, 0.97)');
  ctx.fillStyle = overlayGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 3. BANDA CREMA inferior ───────────────────────────────────────────────
  ctx.fillStyle = '#e8e0cc';
  ctx.fillRect(0, H - 110, W, 110);

  // Línea verde oscura sobre la banda crema
  ctx.fillStyle = '#1e3d20';
  ctx.fillRect(0, H - 114, W, 4);

  // ── 4. ETIQUETA POSICIÓN (badge) ──────────────────────────────────────────
  const posInfo = POS_LABELS[position] || { label: position?.toUpperCase() || '—', short: '—' };
  ctx.fillStyle = '#1e3d20';
  ctx.beginPath();
  roundRect(ctx, 40, H - 370, 180, 50, 8);
  ctx.fill();

  ctx.fillStyle = '#e8e0cc';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(posInfo.short, 130, H - 337);

  // ── 5. NOMBRE DEL JUGADOR ─────────────────────────────────────────────────
  ctx.textAlign = 'left';

  const nameFontSize = playerName.length > 14 ? 72 : playerName.length > 10 ? 86 : 96;
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 18;

  const nameParts = playerName.toUpperCase().split(' ');
  if (nameParts.length > 1) {
    ctx.font = `bold ${Math.round(nameFontSize * 0.6)}px sans-serif`;
    ctx.fillStyle = '#a8c49a'; // verde claro
    ctx.fillText(nameParts[0], 40, H - 300);
    ctx.font = `bold ${nameFontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(nameParts.slice(1).join(' '), 40, H - 210);
  } else {
    ctx.font = `bold ${nameFontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(playerName.toUpperCase(), 40, H - 220);
  }
  ctx.shadowBlur = 0;

  // ── 6. POSICIÓN COMPLETA ──────────────────────────────────────────────────
  ctx.font = '28px sans-serif';
  ctx.fillStyle = 'rgba(232, 224, 204, 0.80)';
  ctx.fillText(posInfo.label, 40, H - 165);

  // ── 7. PRECIO (en banda crema) ────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#1e3d20';
  ctx.fillText('INVERSIÓN', 40, H - 72);
  ctx.font = 'bold 48px sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(`${(price / 1_000_000).toFixed(1)}M €`, 40, H - 28);

  // ── 8. CLUB + TEXTO DERECHA ───────────────────────────────────────────────
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#1e3d20';
  ctx.fillText('NUEVO FICHAJE', W - 40, H - 72);
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText('RACING DE OSLO', W - 40, H - 28);

  // ── 9. NÚMERO DE DORSAL (si se conoce) ────────────────────────────────────
  if (squadNumber > 0) {
    ctx.textAlign = 'right';
    ctx.font = `bold 140px sans-serif`;
    ctx.fillStyle = 'rgba(30, 61, 32, 0.12)';
    ctx.fillText(`#${squadNumber}`, W - 30, H - 130);
  }

  // ── 10. MARCA DE AGUA / LÍNEA SUPERIOR ───────────────────────────────────
  ctx.textAlign = 'center';
  ctx.font = '17px sans-serif';
  ctx.fillStyle = 'rgba(232, 224, 204, 0.65)';
  ctx.fillText('🤖 Mateo Oslomany · Director Deportivo · Racing de Oslo · Est. 2024', W / 2, 36);


  // ── Guardar PNG ───────────────────────────────────────────────────────────
  const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
  const outputPath = path.join(OUTPUT_DIR, `signing_${safeName}_${Date.now()}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

/**
 * Helper: dibuja un rectángulo redondeado
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
