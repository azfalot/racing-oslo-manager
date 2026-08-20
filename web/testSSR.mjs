import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server.js';
import App from './web/src/App.jsx';
import Home from './web/src/pages/Home.jsx';
import Plantilla from './web/src/pages/Plantilla.jsx';
import Noticias from './web/src/pages/Noticias.jsx';
import Tienda from './web/src/pages/Tienda.jsx';
import Entradas from './web/src/pages/Entradas.jsx';
import Clasificacion from './web/src/pages/Clasificacion.jsx';

try {
  console.log('Rendering Home...');
  renderToString(React.createElement(StaticRouter, { location: "/" }, React.createElement(Home)));
  console.log('Rendering Plantilla...');
  renderToString(React.createElement(StaticRouter, { location: "/plantilla" }, React.createElement(Plantilla)));
  console.log('Rendering Noticias...');
  renderToString(React.createElement(StaticRouter, { location: "/noticias" }, React.createElement(Noticias)));
  console.log('Rendering Tienda...');
  renderToString(React.createElement(StaticRouter, { location: "/tienda" }, React.createElement(Tienda)));
  console.log('Rendering Entradas...');
  renderToString(React.createElement(StaticRouter, { location: "/entradas" }, React.createElement(Entradas)));
  console.log('Rendering Clasificacion...');
  renderToString(React.createElement(StaticRouter, { location: "/clasificacion" }, React.createElement(Clasificacion)));
  console.log('All rendered successfully!');
} catch (e) {
  console.error('CRASH:', e);
}
