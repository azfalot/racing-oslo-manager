/**
 * Cliente de Telemetría y Registro de Accesos Web (Privacy-First)
 *
 * Registra visitas locales, páginas vistas y tiempos de sesión
 * sin recopilar datos personales ni usar cookies de terceros.
 */

const STORAGE_KEY = 'rdo_traffic_telemetry';

export function trackPageView(pagePath) {
  try {
    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem(STORAGE_KEY);
    const telemetry = raw ? JSON.parse(raw) : {
      firstVisit: new Date().toISOString(),
      lastVisit: new Date().toISOString(),
      pageViews: 0,
      history: []
    };

    telemetry.pageViews += 1;
    telemetry.lastVisit = new Date().toISOString();
    telemetry.history.push({
      path: pagePath,
      timestamp: Date.now()
    });

    // Guardar últimas 50 navegaciones
    if (telemetry.history.length > 50) {
      telemetry.history = telemetry.history.slice(-50);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(telemetry));
  } catch (e) {
    // Ignorar errores de localStorage privado
  }
}

export function getLocalTrafficTelemetry() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
