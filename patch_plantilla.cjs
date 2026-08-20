const fs = require('fs');
let c = fs.readFileSync('web/src/pages/Plantilla.jsx', 'utf8');

if (!c.includes('Valor de Mercado')) {
  const formatPrice = "const formatPrice = (price) => price ? price.toLocaleString('es-ES') + ' €' : 'Desconocido';";
  c = c.replace("export default function Plantilla() {", "export default function Plantilla() {\n  " + formatPrice);
  
  const injectValue = `
              {/* Valor de Mercado */}
              <div className="px-6 py-4 bg-black border-t border-forest/30 flex justify-between items-center">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">Valor Comunio</p>
                  <p className="font-mono text-cream font-bold">{formatPrice(p.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-cream/50 mb-1">Transfermarkt</p>
                  <p className="font-mono text-forest-light font-bold">{formatPrice(p.tmValue)}</p>
                </div>
              </div>
  `;
  c = c.replace("{/* Estadísticas Históricas */}", injectValue + "\n              {/* Estadísticas Históricas */}");
  
  fs.writeFileSync('web/src/pages/Plantilla.jsx', c);
}
