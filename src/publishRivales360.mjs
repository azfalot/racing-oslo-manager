import { createCanvas, loadImage } from '@napi-rs/canvas';
import { publishPostToComunioApi } from './comunioCommunityPoster.js';
import fs from 'fs';
import path from 'path';

async function createAndPublish() {
  const width = 1200;
  const height = 630;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#041c12');
  bgGrad.addColorStop(0.5, '#020d08');
  bgGrad.addColorStop(1, '#000000');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Decorative grid lines
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
  ctx.lineWidth = 1.5;
  for (let x = 40; x < width; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 40; y < height; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Golden Outer Border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Inner subtle border
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  // Draw Crest
  try {
    const crestImg = await loadImage('web/public/media/crest.jpg');
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 130, 60, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(crestImg, 70, 70, 120, 120);
    ctx.restore();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(130, 130, 60, 0, Math.PI * 2);
    ctx.stroke();
  } catch (e) {}

  // Top Tag
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.fillRect(220, 75, 430, 36);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1;
  ctx.strokeRect(220, 75, 430, 36);

  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('⚡ NOVEDAD OFICIAL EN LA SEDE DIGITAL', 235, 99);

  // Main Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('RIVALES 360º', 220, 165);

  // Subtitle
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('CENTRO DE ANÁLISIS & SCOUTING DE CLUBES', 220, 205);

  // Description text
  ctx.fillStyle = '#d1d5db';
  ctx.font = '20px sans-serif';
  ctx.fillText('Consulta la radiografía táctica completa de los 10 clubes de la liga:', 80, 275);

  // 3 Feature Cards
  const features = [
    { title: '🛡️ ONCE PROYECTADO', desc: 'Pizarra táctica y techo de puntos de cada jornada.' },
    { title: '⚖️ SALUD FINANCIERA', desc: 'Semáforo de solvencia, liquidez y riesgo de deuda.' },
    { title: '🤖 ASISTENCIA IA', desc: 'Sugerencias de mercado según carencias tácticas.' }
  ];

  features.forEach((f, i) => {
    const cardX = 80 + i * 355;
    const cardY = 310;
    ctx.fillStyle = 'rgba(6, 44, 28, 0.7)';
    ctx.fillRect(cardX, cardY, 335, 180);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.strokeRect(cardX, cardY, 335, 180);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(f.title, cardX + 20, cardY + 45);

    ctx.fillStyle = '#d1d5db';
    ctx.font = '16px sans-serif';
    const words = f.desc.split(' ');
    let line = '';
    let currY = cardY + 85;
    for (let w of words) {
      if ((line + w).length > 24) {
        ctx.fillText(line, cardX + 20, currY);
        line = w + ' ';
        currY += 25;
      } else {
        line += w + ' ';
      }
    }
    ctx.fillText(line, cardX + 20, currY);
  });

  // Footer URL Banner
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(80, 520, width - 160, 60);
  ctx.strokeStyle = '#f59e0b';
  ctx.strokeRect(80, 520, width - 160, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('🌐 ACCESO EN ABIERTO:', 110, 557);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('racing-oslo.cotero91.workers.dev/rivales', 360, 557);

  const outDir = 'web/public/media/news_graphics';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.resolve(outDir, 'rivales_360_portal.jpg');
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(outPath, buffer);
  
  const distDir = 'web/dist/media/news_graphics';
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.resolve(distDir, 'rivales_360_portal.jpg'), buffer);

  console.log('✅ Imagen gráfica generada:', outPath);

  // Now publish to Comunio API
  const title = '📊 RIVALES 360º: Radiografía Táctica & Asistencia a Clubes';
  const fullImgUrl = `https://racing-oslo.cotero91.workers.dev/media/news_graphics/rivales_360_portal.jpg?v=${Date.now()}`;
  
  const htmlMessage = 
    '<p>La Junta Directiva y la Secretaría Técnica del <strong>Racing de Oslo</strong> anuncian la apertura pública del nuevo módulo interactivo <strong>RIVALES 360º</strong> en nuestra Sede Digital.<br><br>' +
    '🔍 <strong>CONTENIDO DISPONIBLE PARA CADA CLUB:</strong><br>' +
    ' • <strong>Pizarra Táctica Estimada:</strong> Formación y Once Titular con proyección de puntos para la Jornada 3.<br>' +
    ' • <strong>Semáforo de Salud Financiera:</strong> Auditoría de solvencia, liquidez en caja y control de apalancamiento.<br>' +
    ' • <strong>Asistencia de Fichajes (IA):</strong> Recomendaciones de jugadores actualmente en el mercado según los puntos débiles de cada plantilla.<br>' +
    ' • <strong>Banquillo de Reservas:</strong> Censo de alternativas y rotación.<br><br>' +
    '🌐 <strong>ACCESO LIBRE PARA TODOS LOS MÁNAGERS:</strong><br>' +
    '👉 <a title="Auditoría de Rivales 360" href="https://racing-oslo.cotero91.workers.dev/rivales" target="_blank" rel="noopener"><strong>racing-oslo.cotero91.workers.dev/rivales</strong></a><br><br>' +
    `<a href="https://racing-oslo.cotero91.workers.dev/rivales" target="_blank" rel="noopener"><img src="${fullImgUrl}" alt="Rivales 360 Scouting Portal" width="1024" height="538" style="width: 100%; max-width: 650px; height: auto; border-radius: 8px; border: 1px solid #10b981;"></a><br><br>` +
    '<em>Secretaría Técnica & Área de Análisis · Racing de Oslo</em></p>';

  console.log('Publicando comunicado en el tablón de Comunio...');
  const success = await publishPostToComunioApi(title, htmlMessage);
  console.log('Resultado publicación Comunio:', success ? '¡ÉXITO!' : 'FALLÓ');
}

createAndPublish();
