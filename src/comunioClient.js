import axios from 'axios';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

export class ComunioClient {
  constructor() {
    this.username = process.env.COMUNIO_USERNAME;
    this.password = process.env.COMUNIO_PASSWORD;
    this.token = null;
    this.userId = null;
    this.communityId = null;
    this.isLoggedIn = false;
  }

  getToken() { return this.token; }

  async login() {
    console.log(`[CLIENT] Iniciando sesión para el usuario ${this.username} a través de la API...`);
    try {
      const response = await axios.post('https://api.comunio.es/login', {
        username: this.username,
        password: this.password,
        tzoffset: 2
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });

      if (response.status === 200 && response.data.access_token) {
        this.token = response.data.access_token;
        this.isLoggedIn = true;
        console.log('[CLIENT] Token de autenticación obtenido con éxito.');

        // Obtener IDs de usuario y comunidad llamando al endpoint raíz
        await this.fetchUserAndCommunityIds();
      } else {
        throw new Error('No se recibió el token de acceso.');
      }
    } catch (err) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Error en el login directo: ${errMsg}`);
    }
  }

  async fetchUserAndCommunityIds() {
    console.log('[CLIENT] Obteniendo información de perfil del usuario...');
    try {
      const response = await axios.get('https://api.comunio.es/', {
        headers: this.getHeaders()
      });

      if (response.status === 200 && response.data.user && response.data.community) {
        this.userId = response.data.user.id;
        this.communityId = response.data.community.id;
        console.log(`[CLIENT] Perfil cargado -> Usuario ID: ${this.userId}, Comunidad ID: ${this.communityId}`);
      } else {
        throw new Error('Estructura de respuesta de perfil inválida.');
      }
    } catch (err) {
      throw new Error(`Error al obtener información de usuario/comunidad: ${err.message}`);
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };
  }

  /**
   * Obtiene detalles específicos de un jugador (incluyendo histórico)
   */
  async getPlayerDetails(playerId) {
    try {
      const response = await axios.get(`https://api.comunio.es/players/${playerId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (err) {
      return null;
    }
  }

  /**
   * Obtiene y limpia la información del saldo/crédito actual
   */
  async getDashboardData() {
    if (!this.isLoggedIn) await this.login();
    try {
      const response = await axios.get('https://api.comunio.es/', {
        headers: this.getHeaders()
      });

      if (response.status === 200 && response.data.user) {
        const user = response.data.user;
        // La API devuelve los valores como strings — parsear a número
        const budget = parseInt(user.budget) || 0;
        const teamValue = parseInt(user.teamValue) || 0;
        return { money: budget, teamValue };
      }
    } catch (err) {
      console.warn('[CLIENT] Error al obtener presupuesto desde la API:', err.message);
    }
    return { money: 0, teamValue: 0 };
  }

  /**
   * Obtiene las ofertas/pujas de compra pendientes que tiene activas el usuario
   */
  async getPendingBids() {
    if (!this.isLoggedIn) await this.login();
    try {
      const url = `https://api.comunio.es/communities/${this.communityId}/users/${this.userId}/offers?current`;
      const response = await axios.get(url, {
        headers: this.getHeaders()
      });

      if (response.status === 200 && response.data && response.data.items) {
        return response.data.items
          .filter(item => item.type === 'PURCHASE' && item.state === 'PENDING')
          .map(item => ({
            offerId: item.id,
            playerId: item.tradable?.id,
            playerName: item.tradable?.name,
            price: item.price
          }));
      }
    } catch (err) {
      console.warn('[CLIENT] Error al obtener ofertas pendientes de compra:', err.message);
    }
    return [];
  }

  /**
   * Obtiene la plantilla del usuario
   */
  async getSquad() {
    if (!this.isLoggedIn) await this.login();
    console.log('[CLIENT] Descargando plantilla...');
    try {
      const response = await axios.get(`https://api.comunio.es/users/${this.userId}/squad`, {
        headers: this.getHeaders()
      });

      if (response.status === 200 && response.data.items) {
        console.log(`[CLIENT] Plantilla descargada (${response.data.items.length} jugadores). Buscando detalles históricos...`);
        
        // Enriquecer los jugadores con su historial
        const enrichedPlayers = await Promise.all(response.data.items.map(async (item) => {
          const details = await this.getPlayerDetails(item.id);
          return {
            playerId: item.id,
            name: item.name,
            price: item.quotedprice,
            totalPoints: item.points === '-' ? 0 : parseInt(item.points) || 0,
            status: item.status,
            statusInfo: item.statusInfo,
            type: item.position,
            historical: details?.historical || [],
            average: details?.average || { points: item.averagePoints },
            available: item.status === 'ACTIVE'
          };
        }));

        return { players: enrichedPlayers };
      }
    } catch (err) {
      console.error('[CLIENT] Error descargando la plantilla:', err.message);
    }
    return { players: [] };
  }

  /**
   * Obtiene los jugadores en venta en el mercado de fichajes
   */
  async getMatchdayDetail(matchdayId) {
    console.log(`[CLIENT] Obteniendo detalle de la jornada ${matchdayId}...`);
    try {
      const url = `https://api.comunio.es/matchdays/${matchdayId}`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      return response.data;
    } catch (err) {
      console.warn(`[CLIENT] Error al obtener detalle de la jornada ${matchdayId}:`, err.message);
      return null;
    }
  }

  async getMarket() {
    if (!this.isLoggedIn) await this.login();
    console.log('[CLIENT] Descargando mercado de fichajes...');
    try {
      const response = await axios.get(`https://api.comunio.es/communities/${this.communityId}/users/${this.userId}/exchangemarket`, {
        headers: this.getHeaders()
      });

      if (response.status === 200 && response.data.items) {
        console.log(`[CLIENT] Mercado descargado (${response.data.items.length} fichajes disponibles). Enriqueciendo datos...`);

        const enrichedMarket = await Promise.all(response.data.items.map(async (item) => {
          const playerObj = item._embedded?.player;
          const ownerObj = item._embedded?.owner;

          if (!playerObj) return null;

          const details = await this.getPlayerDetails(playerObj.id);

          return {
            playerId: playerObj.id,
            name: playerObj.name,
            price: playerObj.quotedPrice || playerObj.price || 0,
            type: playerObj.position,
            totalPoints: playerObj.points === '-' ? 0 : parseInt(playerObj.points) || 0,
            status: playerObj.status,
            owner: {
              id: ownerObj?.id || 1,
              name: ownerObj?.name || 'Computer'
            },
            historical: details?.historical || [],
            average: details?.average || { points: '0' }
          };
        }));

        return { players: enrichedMarket.filter(p => p !== null) };
      }
    } catch (err) {
      console.error('[CLIENT] Error descargando el mercado:', err.message);
    }
    return { players: [] };
  }

  /**
   * Realiza una puja por un jugador en el mercado (vía API directa)
   */
  async placeBid(playerId, playerName, bidAmount) {
    if (!this.isLoggedIn) await this.login();
    console.log(`[CLIENT] Colocando puja por ${playerName} (ID ${playerId}) por valor de ${bidAmount}...`);
    try {
      const url = `https://api.comunio.es/communities/${this.communityId}/users/${this.userId}/offers`;
      const response = await axios.post(url, {
        offers: [
          {
            price: parseInt(bidAmount),
            tradableid: parseInt(playerId),
            type: "NEW"
          }
        ]
      }, {
        headers: this.getHeaders()
      });

      if (response.status === 200 || response.status === 201) {
        // La API puede devolver status OK pero contener errores en el body de respuesta
        const resData = response.data;
        if (resData.status === 'OK' && resData.response && resData.response[0]) {
          const offerResult = resData.response[0];
          if (offerResult.status === 'ERROR') {
            console.warn(`[CLIENT] Petición recibida, pero rechazada por Comunio: ${offerResult.message}`);
            return false;
          }
        }
        console.log('[CLIENT] Puja colocada con éxito vía API.');
        return true;
      }
    } catch (err) {
      console.warn('[CLIENT] Error al enviar puja vía API direct, iniciando fallback con Playwright...', err.message);
      return this.placeBidPlaywright(playerName, bidAmount);
    }
    return false;
  }

  async placeBidPlaywright(playerName, bidAmount) {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

      // Cookies
      const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
      if (await acceptBtn.count() > 0) {
        await acceptBtn.first().click();
        await page.waitForTimeout(1000);
      }

      // Login
      const entrarBtn = page.locator('button:has-text("Entrar")');
      await entrarBtn.first().click();
      await page.waitForTimeout(1000);

      await page.fill('input#usernameLogin', this.username);
      await page.fill('input#passwordLogin', this.password);

      const submitBtn = page.locator('button.login_loginButton__lZg4d');
      await submitBtn.click();
      await page.waitForTimeout(5000);

      // Ir a mercado
      await page.goto('https://www.comunio.es/game/market', { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // Localizar jugador
      const playerRow = page.locator(`div:has-text("${playerName}")`).last();
      if (await playerRow.count() === 0) {
        console.error(`[CLIENT-FALLBACK] No se encontró a ${playerName} en el mercado.`);
        return false;
      }

      const bidBtn = playerRow.locator('button:has-text("Pujar"), button:has-text("Ofertar"), button:has-text("Hacer oferta")');
      if (await bidBtn.count() > 0) {
        await bidBtn.first().click();
        await page.waitForTimeout(1500);

        const inputAmount = page.locator('input[type="number"], input[placeholder*="precio"]');
        await inputAmount.fill(bidAmount.toString());

        const confirmBtn = page.locator('button:has-text("Confirmar"), button:has-text("Enviar"), button:has-text("Pujar")');
        await confirmBtn.first().click();
        await page.waitForTimeout(2000);
        console.log(`[CLIENT-FALLBACK] Puja de ${bidAmount} por ${playerName} realizada con éxito.`);
        return true;
      }
    } catch (e) {
      console.error('[CLIENT-FALLBACK] Fallo al pujar con Playwright:', e.message);
    } finally {
      if (browser) await browser.close();
    }
    return false;
  }

  /**
   * Obtiene la alineación actual del usuario
   */
  async getCurrentLineup() {
    if (!this.isLoggedIn) await this.login();
    try {
      const url = `https://api.comunio.es/communities/${this.communityId}/users/${this.userId}/lineup`;
      const response = await axios.get(url, {
        headers: this.getHeaders()
      });

      if (response.status === 200 && response.data && response.data.items) {
        const lineupObj = response.data.items.lineup || {};
        const players = Object.values(lineupObj).map(p => ({
          playerId: p.id,
          name: p.name,
          type: p.type || p.position,
          price: p.quotedprice,
          status: p.status
        }));
        return {
          tactic: response.data.tactic,
          players
        };
      }
    } catch (err) {
      console.warn('[CLIENT] Error al obtener alineación actual:', err.message);
    }
    return null;
  }

  /**
   * Guarda la alineación del equipo (vía API directa)
   */
  async setLineup(playerIds, formation) {
    if (!this.isLoggedIn) await this.login();
    console.log(`[CLIENT] Guardando alineación con formación ${formation} vía API...`);
    try {
      const url = `https://api.comunio.es/communities/${this.communityId}/users/${this.userId}/lineup`;
      
      // 1. Descargar plantilla para clasificar los jugadores por su posición
      const squad = await this.getSquad();
      const squadPlayers = squad.players || [];

      const keepers = [];
      const defenders = [];
      const midfielders = [];
      const strikers = [];

      for (const id of playerIds) {
        const player = squadPlayers.find(p => p.playerId === parseInt(id));
        if (player) {
          if (player.type === 'keeper') keepers.push(id.toString());
          else if (player.type === 'defender') defenders.push(id.toString());
          else if (player.type === 'midfielder') midfielders.push(id.toString());
          else if (player.type === 'striker') strikers.push(id.toString());
        }
      }

      // 2. Ordenar los jugadores para los slots de Comunio: Strikers -> Midfielders -> Defenders -> Keepers
      const orderedPlayers = [...strikers, ...midfielders, ...defenders, ...keepers];

      const lineupMap = {};
      let slot = 1;
      for (const id of orderedPlayers) {
        lineupMap[slot.toString()] = id;
        slot++;
      }

      const tacticCode = formation.replace(/-/g, ''); // "3-5-2" -> "352"

      const payload = {
        userId: this.userId,
        tactic: tacticCode,
        lineup: lineupMap,
        substitutes: {
          striker: "",
          midfielder: "",
          defender: "",
          keeper: ""
        },
        type: "default"
      };

      const response = await axios.put(url, payload, {
        headers: this.getHeaders()
      });

      if (response.status === 200 || response.status === 201) {
        console.log('[CLIENT] Alineación guardada con éxito vía API (PUT).');
        return true;
      }
    } catch (err) {
      console.warn('[CLIENT] Error al guardar alineación vía API direct, iniciando fallback con Playwright...', err.message);
      return this.setLineupPlaywright(playerIds, formation);
    }
    return false;
  }

  async setLineupPlaywright(playerIds, formation) {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

      // Cookies
      const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
      if (await acceptBtn.count() > 0) {
        await acceptBtn.first().click();
        await page.waitForTimeout(1000);
      }

      // Login
      const entrarBtn = page.locator('button:has-text("Entrar")');
      await entrarBtn.first().click();
      await page.waitForTimeout(1000);

      await page.fill('input#usernameLogin', this.username);
      await page.fill('input#passwordLogin', this.password);

      const submitBtn = page.locator('button.login_loginButton__lZg4d');
      await submitBtn.click();
      await page.waitForTimeout(5000);

      // Ir a alineación
      await page.goto('https://www.comunio.es/game/lineup', { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      const tacticBtn = page.locator(`button:has-text("${formation}")`);
      if (await tacticBtn.count() > 0) {
        await tacticBtn.first().click();
        await page.waitForTimeout(1000);
      }

      // Guardar alineación
      const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("Aceptar"), button:has-text("Save")');
      if (await saveBtn.count() > 0) {
        await saveBtn.first().click();
        await page.waitForTimeout(2000);
        console.log(`[CLIENT-FALLBACK] Alineación guardada en interfaz con formación ${formation}.`);
        return true;
      }
    } catch (e) {
      console.error('[CLIENT-FALLBACK] Fallo al guardar alineación con Playwright:', e.message);
    } finally {
      if (browser) await browser.close();
    }
    return false;
  }

  /**
   * Pone a un jugador en venta en el mercado (vía API directa)
   */
  async sellPlayer(playerId, playerName, minPrice) {
    if (!this.isLoggedIn) await this.login();
    console.log(`[CLIENT] Poniendo en venta a ${playerName} (ID ${playerId}) por precio mínimo de ${minPrice} vía API...`);
    try {
      const url = `https://api.comunio.es/communities/${this.communityId}/users/${this.userId}/exchangemarket/addplayer`;
      const response = await axios.post(url, {
        items: [
          {
            tradableId: parseInt(playerId),
            price: parseInt(minPrice)
          }
        ]
      }, {
        headers: this.getHeaders()
      });

      if (response.status === 200 || response.status === 201) {
        console.log(`[CLIENT] ${playerName} puesto en venta con éxito vía API.`);
        return true;
      }
    } catch (err) {
      console.warn('[CLIENT] Error al poner en venta vía API, intentando fallback con Playwright...', err.message);
      return this.sellPlayerPlaywright(playerName, minPrice);
    }
    return false;
  }

  async sellPlayerPlaywright(playerName, minPrice) {
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('https://www.comunio.es', { waitUntil: 'networkidle' });

      // Cookies
      const acceptBtn = page.locator('button:has-text("AGREE"), button:has-text("Aceptar"), #accept-btn');
      if (await acceptBtn.count() > 0) {
        await acceptBtn.first().click();
        await page.waitForTimeout(1000);
      }

      // Login
      const entrarBtn = page.locator('button:has-text("Entrar")');
      await entrarBtn.first().click();
      await page.waitForTimeout(1000);

      await page.fill('input#usernameLogin', this.username);
      await page.fill('input#passwordLogin', this.password);

      const submitBtn = page.locator('button.login_loginButton__lZg4d');
      await submitBtn.click();
      await page.waitForTimeout(5000);

      // Ir a mercado
      await page.goto('https://www.comunio.es/game/market', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const sellTab = page.locator('button:has-text("Vender"), button:has-text("Poner en venta")');
      if (await sellTab.count() > 0) {
        await sellTab.first().click();
        await page.waitForTimeout(1000);
      }

      const playerRow = page.locator(`div:has-text("${playerName}")`).last();
      if (await playerRow.count() === 0) {
        console.error(`[CLIENT-FALLBACK] No se encontró a ${playerName} en tu lista de jugadores en venta.`);
        return false;
      }

      const setPriceBtn = playerRow.locator('button:has-text("Vender"), button:has-text("Poner en el mercado")');
      await setPriceBtn.first().click();
      await page.waitForTimeout(1000);

      const priceInput = page.locator('input[type="number"]');
      await priceInput.fill(minPrice.toString());

      const confirmBtn = page.locator('button:has-text("Confirmar"), button:has-text("Aceptar")');
      await confirmBtn.first().click();
      await page.waitForTimeout(2000);
      console.log(`[CLIENT-FALLBACK] ${playerName} puesto en venta por ${minPrice} con éxito.`);
      return true;
    } catch (e) {
      console.error('[CLIENT-FALLBACK] Fallo al poner en venta con Playwright:', e.message);
    } finally {
      if (browser) await browser.close();
    }
    return false;
  }

  /**
   * Obtiene las próximas jornadas de la liga
   */
  async getMatchdays() {
    if (!this.isLoggedIn) await this.login();
    try {
      const response = await axios.get('https://api.comunio.es/matchdays', {
        headers: this.getHeaders()
      });
      if (response.status === 200 && response.data) {
        const raw = Array.isArray(response.data) ? response.data : (response.data.items || []);
        // Ordenar por matchdayKey ascendente y devolver solo jornadas regulares (no aplazadas)
        return raw
          .filter(md => md.type === 'matchday' || md.type === 'regular')
          .sort((a, b) => a.matchdayKey - b.matchdayKey)
          .map(md => ({
            id: md.id,
            matchdayKey: md.matchdayKey,
            started: md.started,
            finished: md.finished,
            type: md.type,
            eventInfo: md.eventInfo
          }));
      }
    } catch (err) {
      console.warn('[CLIENT] Error al obtener jornadas:', err.message);
    }
    return [];
  }

  /**
   * Obtiene los jugadores más valiosos de la plataforma (top por precio)
   */
  async getTopPlayers() {
    if (!this.isLoggedIn) await this.login();
    try {
      const response = await axios.get('https://api.comunio.es/portlets/players?filterBy=topQuote', {
        headers: this.getHeaders()
      });
      if (response.status === 200 && response.data) {
        const items = Array.isArray(response.data) ? response.data : (response.data.items || []);
        return items.map(p => ({
          playerId: p.id || p.playerId,
          name: p.name,
          price: p.quotedprice || p.price || 0,
          type: p.position || p.type,
          status: p.status,
          totalPoints: p.points === '-' ? 0 : parseInt(p.points) || 0
        }));
      }
    } catch (err) {
      console.warn('[CLIENT] Error al obtener top jugadores:', err.message);
    }
    return [];
  }

  /**
   * Cancela una puja activa por su offerId
   */
  async cancelBid(offerId, playerName) {
    if (!this.isLoggedIn) await this.login();
    console.log(`[CLIENT] Cancelando puja (offerId: ${offerId}) por ${playerName}...`);
    try {
      const url = `https://api.comunio.es/communities/${this.communityId}/users/${this.userId}/offers/${offerId}`;
      const response = await axios.delete(url, {
        headers: this.getHeaders()
      });
      if (response.status === 200 || response.status === 204) {
        console.log(`[CLIENT] Puja por ${playerName} cancelada con éxito.`);
        return true;
      }
    } catch (err) {
      console.warn(`[CLIENT] Error al cancelar puja por ${playerName}:`, err.message);
    }
    return false;
  }

  async close() {
    console.log('[CLIENT] Sesión finalizada.');
  }
}
