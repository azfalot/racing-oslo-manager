const fs = require('fs');
let code = fs.readFileSync('src/comunioClient.js', 'utf8');
const method = `
  async getStandings() {
    if (!this.isLoggedIn) await this.login();
    try {
      const url = \`https://api.comunio.es/communities/\${this.communityId}/standings?period=season\`;
      const response = await axios.get(url, { headers: this.getHeaders() });
      if (response.status === 200 && response.data && response.data.items) {
        const items = Object.values(response.data.items)[0];
        if (items && items.players) {
          return items.players;
        }
      }
      return [];
    } catch (error) {
      console.error('[CLIENT] Error al obtener clasificación:', error.response?.data || error.message);
      return [];
    }
  }
`;
code = code.replace(/async close\(\) \{\s*console\.log\('\[CLIENT\] Sesión finalizada\.'\);\s*\}/, match => method + '\n  ' + match);
// If it failed due to encoding of 'ó' in 'Sesión', let's use a simpler regex
code = code.replace(/async close\(\) \{[\s\S]*?console\.log\('\[CLIENT\].*?\}\n\}/, match => method + '\n' + match);

fs.writeFileSync('src/comunioClient.js', code, 'utf8');
