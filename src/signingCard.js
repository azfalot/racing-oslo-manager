import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, '..', 'assets', 'signing_template.jpg');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'generated');

const POS_LABELS = {
  keeper:     { label: 'PORTERO',         short: 'POR' },
  defender:   { label: 'DEFENSA',         short: 'DEF' },
  midfielder: { label: 'CENTROCAMPISTA',  short: 'MED' },
  striker:    { label: 'DELANTERO',       short: 'DEL' }
};

/**
 * Descarga la foto del jugador desde la API de Comunio.
 * @param {number} playerId
 * @param {string} authToken - Bearer token de Comunio
 * @returns {Buffer|null}
 */
async function fetchPlayerPhoto(playerId, authToken) {
  if (!playerId || !authToken) return null;
  try {
    const url = `https://api.comunio.es/players/${playerId}/photo?size=l&cropped=1`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${authToken}` },
      responseType: 'arraybuffer',
      timeout: 8000
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.warn(`[SIGNING-CARD] No se pudo obtener foto del jugador ${playerId}: ${e.message}`);
    return null;
  }
}

/**
 * Dibuja la foto del jugador como un círculo en la esquina superior derecha.
 * El fondo blanco de la foto de Comunio se elimina usando un clip circular.
 */
async function drawPlayerPhoto(ctx, photoBuffer, x, y, diameter) {
  try {
    const img = await loadImage(photoBuffer);
    const r = diameter / 2;
    const cx = x + r;
    const cy = y + r;

    // Sombra externa del círculo
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1e3d20';
    ctx.fill();
    ctx.restore();

    // Recorte circular para la foto
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Dibujar imagen — centrada y cubriendo el círculo
    const scale = Math.max(diameter / img.width, diameter / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    const sx = cx - sw / 2;
    const sy = cy - sh / 2;
    ctx.drawImage(img, sx, sy, sw, sh);
    ctx.restore();

    // Borde verde oscuro alrededor del círculo
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#1e3d20';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Borde crema fino interior
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#e8e0cc';
    ctx.lineWidth = 2;
    ctx.stroke();

  } catch (e) {
    console.warn('[SIGNING-CARD] Error al dibujar la foto del jugador:', e.message);
  }
}

/**
 * Dibuja el logo Hookr en el estilo de la equipación.
 * "Hookr" en fuente sans-serif + marca de Comunio a la izquierda.
 */
function drawHookrLogo(ctx, x, y, size = 36) {
  ctx.save();

  // Fondo semitransparente
  ctx.fillStyle = 'rgba(232, 224, 204, 0.15)';
  roundRect(ctx, x - 8, y - size * 0.85, 160, size + 14, 6);
  ctx.fill();

  // "C" de Comunio en verde
  ctx.font = `bold ${size * 0.85}px sans-serif`;
  ctx.fillStyle = '#1e3d20';
  ctx.textAlign = 'left';
  ctx.fillText('C', x, y);

  // "Hookr" en blanco / crema
  ctx.font = `bold ${size}px sans-serif`;
  ctx.fillStyle = '#e8e0cc';
  ctx.fillText('Hookr', x + size * 0.7, y);

  ctx.restore();
}

/**
 * Helper: rectángulo redondeado
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

/**
 * Genera la tarjeta de presentación de nuevo fichaje.
 * @param {string} playerName
 * @param {string} position - 'keeper' | 'defender' | 'midfielder' | 'striker'
 * @param {number} price - Precio en euros
 * @param {object} opts - { squadNumber, playerId, authToken }
 * @returns {string} - Ruta al PNG generado
 */
export async function generateSigningCard(playerName, position, price, opts = {}) {
  const { squadNumber = 0, playerId = null, authToken = null } = opts;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const W = 1200;
  const H = 800;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── 1. FONDO: imagen plantilla ────────────────────────────────────────────
  try {
    const template = await loadImage(TEMPLATE_PATH);
    ctx.drawImage(template, 0, 0, W, H);
  } catch (e) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0f1e0f');
    grad.addColorStop(1, '#1a2f1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ── 2. OVERLAY degradado inferior ─────────────────────────────────────────
  const overlayGrad = ctx.createLinearGradient(0, H * 0.38, 0, H);
  overlayGrad.addColorStop(0, 'rgba(15, 30, 15, 0)');
  overlayGrad.addColorStop(0.32, 'rgba(15, 30, 15, 0.82)');
  overlayGrad.addColorStop(1, 'rgba(10, 20, 10, 0.98)');
  ctx.fillStyle = overlayGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 3. FOTO DEL JUGADOR (esquina superior derecha) ────────────────────────
  const photoDiameter = 240;
  const photoX = W - photoDiameter - 50;
  const photoY = 40;

  let photoBuffer = null;
  if (playerId && authToken) {
    photoBuffer = await fetchPlayerPhoto(playerId, authToken);
  }
  if (photoBuffer) {
    await drawPlayerPhoto(ctx, photoBuffer, photoX, photoY, photoDiameter);
  }

  // ── 4. LOGO HOOKR (encima de la foto o en zona central si no hay foto) ────
  const hookrY = photoBuffer ? photoY + photoDiameter + 18 : 60;
  const hookrX = photoBuffer ? photoX - 10 : W - 180;
  drawHookrLogo(ctx, hookrX, hookrY, 28);

  // ── 5. BANDA CREMA inferior ───────────────────────────────────────────────
  ctx.fillStyle = '#e8e0cc';
  ctx.fillRect(0, H - 110, W, 110);
  ctx.fillStyle = '#1e3d20';
  ctx.fillRect(0, H - 114, W, 4);

  // ── 6. BADGE POSICIÓN ─────────────────────────────────────────────────────
  const posInfo = POS_LABELS[position] || { label: position?.toUpperCase() || '—', short: '—' };
  ctx.fillStyle = '#1e3d20';
  ctx.beginPath();
  roundRect(ctx, 40, H - 370, 180, 50, 8);
  ctx.fill();
  ctx.fillStyle = '#e8e0cc';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(posInfo.short, 130, H - 337);

  // ── 7. NOMBRE DEL JUGADOR ─────────────────────────────────────────────────
  ctx.textAlign = 'left';
  const nameFontSize = playerName.length > 14 ? 70 : playerName.length > 10 ? 84 : 96;
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 20;

  const nameParts = playerName.toUpperCase().split(' ');
  if (nameParts.length > 1) {
    ctx.font = `bold ${Math.round(nameFontSize * 0.58)}px sans-serif`;
    ctx.fillStyle = '#a8c49a';
    ctx.fillText(nameParts[0], 40, H - 300);
    ctx.font = `bold ${nameFontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(nameParts.slice(1).join(' '), 40, H - 212);
  } else {
    ctx.font = `bold ${nameFontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(playerName.toUpperCase(), 40, H - 220);
  }
  ctx.shadowBlur = 0;

  // ── 8. POSICIÓN COMPLETA ──────────────────────────────────────────────────
  ctx.font = '26px sans-serif';
  ctx.fillStyle = 'rgba(232,224,204,0.78)';
  ctx.fillText(posInfo.label, 40, H - 168);

  // ── 9. PRECIO EN BANDA CREMA ──────────────────────────────────────────────
  ctx.textAlign = 'left';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#1e3d20';
  ctx.fillText('INVERSIÓN', 40, H - 72);
  ctx.font = 'bold 50px sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(`${(price / 1_000_000).toFixed(1)}M €`, 40, H - 22);

  // ── 10. TEXTO DERECHA EN BANDA ────────────────────────────────────────────
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#1e3d20';
  ctx.fillText('NUEVO FICHAJE', W - 40, H - 72);
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText('RACING DE OSLO', W - 40, H - 22);

  // ── 11. NÚMERO DORSAL (watermark) ─────────────────────────────────────────
  if (squadNumber > 0) {
    ctx.textAlign = 'right';
    ctx.font = `bold 140px sans-serif`;
    ctx.fillStyle = 'rgba(30, 61, 32, 0.10)';
    ctx.fillText(`#${squadNumber}`, W - 30, H - 130);
  }

  // ── 12. MARCA DE AGUA SUPERIOR ────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(232,224,204,0.55)';
  ctx.fillText('🤖 Mateo Oslomany · Director Deportivo · Racing de Oslo · Est. 2024', W / 2, 30);

  // ── Guardar PNG ───────────────────────────────────────────────────────────
  const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
  const outputPath = path.join(OUTPUT_DIR, `signing_${safeName}_${Date.now()}.png`);
  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  return outputPath;
}
