# 💼 Racing de Oslo Manager Bot

> **Director Deportivo:** Mateo Oslomany
> **Club:** Racing de Oslo (azfalot)
> **Plataforma:** Comunio España

Bienvenido al centro de operaciones e inteligencia deportiva del **Racing de Oslo**. Este bot gestiona la plantilla, optimiza alineaciones en base a rendimiento e información médica, realiza análisis de mercado en tiempo real contra Transfermarkt y ejecuta pujas y ventas estratégicas directamente mediante la API de Comunio.

---

## 🚀 Características Clave

* **API-First Architecture:** Todas las operaciones críticas (alineación, pujas, ventas, lectura de saldos) se realizan directamente a través de peticiones HTTP (`Axios`) rápidas y ligeras, evitando el uso de navegadores virtuales pesados en el 99% de las ejecuciones.
* **Control Inteligente de Pujas Duplicadas:** Descarga y compara en tiempo real las ofertas pendientes en los servidores de Comunio para evitar reenviar pujas duplicadas.
* **Margen de Puja Dinámico (`/margen`):** Permite configurar un sobreprecio estratégico por encima del mínimo de mercado directamente desde Telegram para asegurar el fichaje de estrellas.
* **Historial de Fichajes y Ventas:** Registra instantáneas de la plantilla en cada ejecución y reporta altas y bajas directamente al móvil.
* **Análisis de Rivales:** Escaneo completo de las plantillas de todos los miembros de la liga, ordenados por valoración total y listando sus tres estrellas principales.
* **Fórmula de Eficiencia (PPM):** Evalúa candidatos en el mercado basándose en su rendimiento esperado de puntos dividido por su valor de mercado.

---

## 🤖 Comandos de Telegram (Mateo Oslomany)

El bot responde a comandos directos en el chat con tu director deportivo de confianza:

### 📊 Análisis y Consultas (Lectura)
* `/reporte` - Mateo compila y te envía el informe completo de dirección deportiva del día (sólo lectura).
* `/rivales` - Analiza la valoración y estrellas de las plantillas del resto de miembros de la liga.
* `/sugerencias` - Sugiere qué jugadores suplentes de alto valor o lesionados conviene vender para ganar liquidez.

### ⚡ Acciones e Interacción (Escritura)
* `/alinear` - Optimiza y guarda directamente en Comunio el 11 titular ideal de la jornada según estado físico y rendimiento.
* `/vender <nombre_jugador>` - Pone en venta de inmediato al jugador indicado en el mercado de Comunio por su precio mínimo.
* `/margen <porcentaje>` - Modifica el sobreprecio extra a aplicar sobre las ofertas de compra (ej: `/margen 1.5`).

---

## 🕒 Horarios de Ejecución Programada

El daemon en segundo plano realiza ciclos de optimización y reportes automáticos tres veces al día (Hora de Madrid):
* **09:00 a.m. ➔ Informe Matinal:** Descarga las novedades de mercado de la Computadora y envía el informe diario inicial.
* **15:00 p.m. ➔ Informe de Tarde:** Actualización de mercado y noticias.
* **02:50 a.m. ➔ Cierre de Mercado (Crítico):** A solo 10 minutos del límite de los servidores de Comunio, Mateo realiza la alineación final con las últimas noticias de lesionados y envía las pujas definitivas.

---

## 🛠️ Instalación y Configuración Local

### 1. Requisitos Previos
* NodeJS (v18 o superior)
* Git

### 2. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto:
```env
COMUNIO_USERNAME=tu_usuario
COMUNIO_PASSWORD=tu_contraseña
COMUNIO_MODE=autonomo # 'asistente' o 'autonomo'
TELEGRAM_BOT_TOKEN=tu_token_de_bot_de_telegram
TELEGRAM_CHAT_ID=tu_chat_id_de_telegram
```

### 3. Ejecutar el Daemon

#### Opción Básica:
Haz doble clic en el archivo `run_daemon.bat` en Windows.

#### Opción en Segundo Plano (Recomendada con PM2):
```powershell
# Instalar PM2 de forma global
npm install -g pm2

# Iniciar el bot en segundo plano
pm2 start src/daemon.js --name "comunio-bot"

# Ver estado y logs
pm2 status
pm2 logs comunio-bot
```

---

## 📂 Estructura del Código

* `src/comunioClient.js` - Cliente de conexión directa con la API de Comunio (con fallback en Playwright).
* `src/engine.js` - Motor matemático de toma de decisiones (alineación, economía, ofertas).
* `src/daemon.js` - Listener de comandos de Telegram y planificador de ejecuciones diarias.
* `src/app.js` - Orquestador del reporte diario y flujo principal de optimización.
