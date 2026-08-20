const fs = require('fs');
let c = fs.readFileSync('web/src/pages/Mercado.jsx', 'utf8');

if (!c.includes('<th>TM</th>')) {
  // Add column headers
  c = c.replace(/<th className="p-4 font-semibold text-center">Puntos<\/th>/g, 
    '<th className="p-4 font-semibold text-center">Puntos</th>\n                  <th className="p-4 font-semibold text-right">TM</th>');
  
  // Add cell
  c = c.replace(/<td className="p-4 text-center font-bold text-forest-light">{p.points} pts<\/td>/g,
    '<td className="p-4 text-center font-bold text-forest-light">{p.points} pts</td>\n      <td className="p-4 text-right font-mono text-sm text-forest-light">{formatPrice(p.tmValue)}</td>');

  fs.writeFileSync('web/src/pages/Mercado.jsx', c);
}
