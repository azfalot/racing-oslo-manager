import axios from 'axios';

export async function fetchLatestNews(amount = 5) {
  try {
    const url = `https://api.comunio.es/portlets/feed/blog_rss_home_es_es?amount=${amount}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });

    if (response.status === 200 && response.data && response.data.feedArticles) {
      return response.data.feedArticles.map(article => ({
        title: article.subject,
        url: article.href,
        date: article.pubDate,
        img: article.imgUrl
      }));
    }
  } catch (err) {
    console.warn('[NEWS] No se pudieron descargar las noticias públicas de Comunio:', err.message);
  }
  return [];
}
