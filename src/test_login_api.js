import axios from 'axios';

async function main() {
  try {
    const res = await axios.post('https://api.comunio.es/login', {
      username: 'fakeuser_antigravity',
      password: 'fakepassword123',
      tzoffset: 2
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    console.log('Status:', res.status);
    console.log('Headers:', res.headers);
    console.log('Data:', res.data);
  } catch (err) {
    console.log('Error Status:', err.response ? err.response.status : 'No response');
    console.log('Error Data:', err.response ? err.response.data : err.message);
  }
}

main();
