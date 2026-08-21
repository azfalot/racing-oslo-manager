import { ComunioClient } from '../src/comunioClient.js';
import axios from 'axios';

async function testAllEndpoints() {
  const c = new ComunioClient();
  await c.login();
  const headers = c.getHeaders();
  const cid = c.communityId;
  console.log('Testing community ID:', cid);

  const endpoints = [
    `/communities/${cid}/standings`,
    `/communities/${cid}/standings?period=total`,
    `/communities/${cid}/standings?period=season`,
    `/communities/${cid}/standings?period=current`,
    `/communities/${cid}/standings?period=live`,
    `/communities/${cid}/users`,
    `/communities/${cid}/members`,
    `/communities/${cid}/live`,
    `/communities/${cid}/livestandings`,
    `/communities/${cid}/userstandings`,
    `/communities/${cid}/rankings`,
    `/communities/${cid}/exchangemarket`,
    `/matchdays/current`
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.get(`https://api.comunio.es${ep}`, { headers });
      console.log(`\n=== ENDPOINT: ${ep} ===`);
      console.log(JSON.stringify(res.data, null, 2).slice(0, 500));
    } catch (e) {
      console.log(`\n=== ENDPOINT: ${ep} === ERROR: ${e.response?.status || e.message}`);
    }
  }

  await c.close();
}

testAllEndpoints();
