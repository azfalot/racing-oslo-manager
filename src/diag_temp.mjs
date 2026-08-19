import dotenv from 'dotenv';
dotenv.config();
import { ComunioClient } from './comunioClient.js';
import axios from 'axios';

const client = new ComunioClient();
await client.login();
const token = client.getToken();

try {
  // Ofertas recibidas?
  const res = await axios.get(`https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/offers`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('Ofertas (sin param):', res.data.items?.length);
  
  const res2 = await axios.get(`https://api.comunio.es/communities/${client.communityId}/users/${client.userId}/offers?type=incoming`, { headers: { Authorization: `Bearer ${token}` } });
  console.log('Ofertas (incoming):', res2.data.items?.length);
  
} catch(e) {
  console.log('Error fetch offers:', e.message);
}

await client.close();
