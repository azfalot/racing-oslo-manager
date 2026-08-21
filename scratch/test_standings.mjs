import { ComunioClient } from '../src/comunioClient.js';
import axios from 'axios';

async function test() {
  const c = new ComunioClient();
  await c.login();
  const headers = c.getHeaders();
  const cid = c.communityId;
  console.log('Community ID:', cid);

  const url1 = `https://api.comunio.es/communities/${cid}/standings`;
  const r1 = await axios.get(url1, { headers });
  console.log('Standings default:', JSON.stringify(r1.data, null, 2));

  const url2 = `https://api.comunio.es/communities/${cid}/userstandings`;
  const r2 = await axios.get(url2, { headers }).catch(e => ({ data: e.response?.data || e.message }));
  console.log('User standings:', JSON.stringify(r2.data, null, 2));

  const url3 = `https://api.comunio.es/communities/${cid}/users/${c.userId}/standings`;
  const r3 = await axios.get(url3, { headers }).catch(e => ({ data: e.response?.data || e.message }));
  console.log('User self standings:', JSON.stringify(r3.data, null, 2));

  await c.close();
}

test();
