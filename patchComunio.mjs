import fs from 'fs';
let code = fs.readFileSync('src/comunioClient.js', 'utf8');

const newMethod = `
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

code = code.replace(/async getDashboardData\(\) \{[\s\S]*?\}\n  \}/, match => match + newMethod);
fs.writeFileSync('src/comunioClient.js', code, 'utf8');
