import { ComunioClient } from '../src/comunioClient.js';
import axios from 'axios';

async function test() {
  const c = new ComunioClient();
  await c.login();
  const headers = c.getHeaders();
  const cid = c.communityId;

  const url = `https://api.comunio.es/communities/${cid}/standings?period=live`;
  const res = await axios.get(url, { headers });
  
  console.log('=== LIVE STANDINGS ITEMS ===');
  res.data.items.forEach((item, index) => {
    const user = item._embedded?.user;
    console.log(`${index + 1}. ${user?.name} (ID ${user?.id}) -> livePoints: ${item.livePoints}, totalPoints: ${item.totalPoints}, playersScored: ${item.playersPossiblyScoredAmount}`);
  });

  await c.close();
}

test();
