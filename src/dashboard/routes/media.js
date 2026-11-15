// src/dashboard/routes/media.js
// Extracted route group for the dashboard dispatcher.

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../../paths');
const { publicBaseUrl } = require('../http');

const CARD_DIR = path.join(DATA_DIR, 'cards');

/**
 * @param {object} ctx - { req, res, url, secureHeaders }
 * @returns {Promise<boolean>} true when a route was handled
 */
async function handleMediaRoutes({ req, res, url, secureHeaders }) {
    // ── Daily Cyber Podcast APIs & RSS Syndication ─────────────────────
    if (url === '/api/podcast/latest') {
      try {
        const { getLatestPodcastEpisode } = require('../../db');
        const { compileDailyPodcast } = require('../../podcast-generator');
        let latest = getLatestPodcastEpisode();
        if (!latest) {
          latest = await compileDailyPodcast();
        }
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify(latest));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    if (url === '/podcast.xml' || url === '/podcast' || url === '/feed/podcast.xml') {
      try {
        const { generatePodcastRssXml } = require('../../podcast-generator');
        const xml = generatePodcastRssXml(publicBaseUrl(req));
        res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8', ...secureHeaders() });
        res.end(xml);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...secureHeaders() });
        res.end('Error generating podcast RSS feed');
      }
      return true;
    }

    if (url === '/podcast.xsl') {
      try {
        const { getPodcastXsl } = require('../../podcast-generator');
        res.writeHead(200, { 'Content-Type': 'text/xsl; charset=utf-8', ...secureHeaders() });
        res.end(getPodcastXsl());
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain', ...secureHeaders() });
        res.end('Error generating podcast XSL stylesheet');
      }
      return true;
    }

    // ── Podcast Audio Stream (/api/podcast/audio, /api/podcast/audio/:episodeId) ──
    if (url.startsWith('/api/podcast/audio')) {
      try {
        const { getPodcastAudioPath } = require('../../podcast-generator');
        const parts = url.split('/');
        const epId = parts.length > 4 ? parts[4] : null;
        const audioPath = getPodcastAudioPath(epId);
        if (audioPath && fs.existsSync(audioPath)) {
          const stat = fs.statSync(audioPath);
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': stat.size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            ...secureHeaders()
          });
          const stream = fs.createReadStream(audioPath);
          stream.pipe(res);
          return true;
        }
        res.writeHead(404, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Podcast audio file not found' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    // ── Generated SVG alert cards ──────────────────────────────────────
    if (url.startsWith('/cards/')) {
      const name = url.slice('/cards/'.length);
      if (!/^card_[a-f0-9]{16}\.svg$/.test(name)) {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...secureHeaders() });
        res.end('Not found');
        return true;
      }
      const cardPath = path.join(CARD_DIR, name);
      if (!fs.existsSync(cardPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain', ...secureHeaders() });
        res.end('Not found');
        return true;
      }
      res.writeHead(200, {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        ...secureHeaders({ 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" })
      });
      res.end(fs.readFileSync(cardPath));
      return true;
    }


  return false;
}

module.exports = { handleMediaRoutes };
