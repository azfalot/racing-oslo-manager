import dotenv from 'dotenv';
dotenv.config();
import { ComunioClient } from './src/comunioClient.js';
import axios from 'axios';

async function test() {
  const client = new ComunioClient();
  await client.login();
  try {
    const url = `https://api.comunio.es/communities/${client.communityId}/standings?period=season`;
    const res = await axios.get(url, { headers: client.getHeaders() });
    console.log("Standings:", JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.log("Error:", e.response ? e.response.status : e.message);
  }
}
test();
