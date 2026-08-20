const fs = require('fs');

let c = fs.readFileSync('src/app.js', 'utf8');

if (!c.includes('web/src/data/news.json')) {
  const injectNews = `
            // GENERATE WEB NEWS
            try {
              if (fs.existsSync('web/src/data/news.json')) {
                const news = JSON.parse(fs.readFileSync('web/src/data/news.json', 'utf8'));
                for (const p of newSignings) {
                  const newArticle = {
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    title: \`¡Oficial! \${p.name} ficha por el Racing de Oslo\`,
                    date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
                    excerpt: \`El club hace oficial la incorporación de \${p.name} tras abonar su cláusula en el mercado.\`,
                    content: \`Mateo Oslomany ha cerrado otra operación maestra. \${p.name} se une a las filas del Racing de Oslo por una cantidad cercana a los \${p.price.toLocaleString()} €. La dirección deportiva confía en que su rendimiento justifique la gran inversión realizada en este mercado.\\n\\n¡Bienvenido a tu nueva casa!\`,
                    image: \`/media/players/\${p.playerId}.png\`
                  };
                  news.unshift(newArticle);
                }
                fs.writeFileSync('web/src/data/news.json', JSON.stringify(news, null, 2));
              }
            } catch (e) {
              console.error('[NEWS] Error generando noticia en la web:', e.message);
            }
  `;
  
  c = c.replace("changeReport += `   <b>${escapeHtml(p.name)}</b> - Valor: ${p.price.toLocaleString()} €\\n`;\n              });", "changeReport += `   <b>${escapeHtml(p.name)}</b> - Valor: ${p.price.toLocaleString()} €\\n`;\n              });\n" + injectNews);
  fs.writeFileSync('src/app.js', c);
}
