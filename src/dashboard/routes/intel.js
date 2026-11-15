// src/dashboard/routes/intel.js
// Extracted route group for the dashboard dispatcher.

const { isTokenValid } = require('../auth');
const { publicBaseUrl } = require('../http');
const { isDemoMode } = require('../../db');

/**
 * @param {object} ctx - { req, res, url, pipeline, secureHeaders }
 * @returns {Promise<boolean>} true when a route was handled
 */
async function handleIntelRoutes({ req, res, url, pipeline, secureHeaders }) {
    // ── SIEM / SOAR Rule Hub & Push APIs ──────────────────────────────
    if (url === '/api/siem/rules' && req.method === 'GET') {
      try {
        const { getAllDetectionRules } = require('../../db');
        const { formatSiemPackage } = require('../../siem-sync');
        const rules = getAllDetectionRules(20);
        const packages = rules.map((r) => formatSiemPackage(r.cveId, r.sigmaYaml, r.yaraRule));
        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: packages.length, rules: packages }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }

    if (url === '/api/siem/push' && req.method === 'POST') {
      if (!isTokenValid(req, 'admin')) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return true;
      }
      let bodyText = '';
      req.on('data', (c) => { if (bodyText.length < 100000) bodyText += c; });
      req.on('end', async () => {
        try {
          const { cveId, platform = 'sentinel', dryRun = true } = JSON.parse(bodyText);
          const { getCachedDetectionRule } = require('../../db');
          const { formatSiemPackage, pushRuleToSentinel } = require('../../siem-sync');
          const cached = getCachedDetectionRule(cveId);
          if (!cached) {
            res.writeHead(404, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: `Detection rule not found for ${cveId}` }));
            return true;
          }
          const pkg = formatSiemPackage(cveId, cached.sigmaYaml, cached.yaraRule);
          const result = await pushRuleToSentinel(pkg, { dryRun: Boolean(dryRun) });
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return true;
    }

    // ── TAXII 2.1 & STIX 2.1 Threat Feed Endpoints ────────────────────
    if (url === '/taxii2/' || url === '/taxii2') {
      const { getTaxiiDiscovery } = require('../../tip-sync');
      const discovery = getTaxiiDiscovery(publicBaseUrl(req));
      res.writeHead(200, { 'Content-Type': 'application/taxii+json;version=2.1', ...secureHeaders() });
      res.end(JSON.stringify(discovery, null, 2));
      return true;
    }

    if (url === '/taxii2/root/' || url === '/taxii2/root') {
      const { getTaxiiApiRoot } = require('../../tip-sync');
      const root = getTaxiiApiRoot(publicBaseUrl(req));
      res.writeHead(200, { 'Content-Type': 'application/taxii+json;version=2.1', ...secureHeaders() });
      res.end(JSON.stringify(root, null, 2));
      return true;
    }

    if (url === '/taxii2/root/collections/' || url === '/taxii2/root/collections') {
      const { getTaxiiCollections } = require('../../tip-sync');
      const collections = getTaxiiCollections(publicBaseUrl(req));
      res.writeHead(200, { 'Content-Type': 'application/taxii+json;version=2.1', ...secureHeaders() });
      res.end(JSON.stringify(collections, null, 2));
      return true;
    }

    if (url.startsWith('/taxii2/root/collections/') && url.endsWith('/objects/')) {
      const { getAggregatedStixBundle } = require('../../tip-sync');
      const bundle = getAggregatedStixBundle();
      res.writeHead(200, { 'Content-Type': 'application/stix+json;version=2.1', ...secureHeaders() });
      res.end(JSON.stringify(bundle, null, 2));
      return true;
    }

    if (url === '/api/stix/bundle') {
      const { getAggregatedStixBundle } = require('../../tip-sync');
      const bundle = getAggregatedStixBundle();
      res.writeHead(200, { 'Content-Type': 'application/stix+json;version=2.1', ...secureHeaders() });
      res.end(JSON.stringify(bundle, null, 2));
      return true;
    }

    if (url === '/api/misp/events') {
      const { exportToMISPEvent } = require('../../tip-sync');
      const articles = pipeline.getRecentArticles(10);
      const events = articles.map((a) => {
        const text = `${a.title} ${a.description || ''}`;
        const cves = (text.match(/CVE-\d{4}-\d{4,7}/gi) || []).map((c) => ({ cveId: c.toUpperCase() }));
        const ips = text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
        const hashes = text.match(/\b[a-f0-9]{32,64}\b/gi) || [];
        return exportToMISPEvent(a, { cves, iocs: { ips, hashes } });
      });
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ count: events.length, events }));
      return true;
    }

    // ── Source Reputation & Scoring API ───────────────────────────────
    if (url === '/api/sources/reputation' && req.method === 'GET') {
      const { getAllSourceReputations } = require('../../scorer');
      res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
      res.end(JSON.stringify({ reputations: getAllSourceReputations() }));
      return true;
    }

    if (url === '/api/sources/reputation' && req.method === 'POST') {
      if (!isTokenValid(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: 'Unauthorized: Admin token required' }));
        return true;
      }
      let bodyText = '';
      req.on('data', (c) => { if (bodyText.length < 100000) bodyText += c; });
      req.on('end', () => {
        try {
          const { source, reputation } = JSON.parse(bodyText);
          const { setSourceReputation, getAllSourceReputations } = require('../../scorer');
          if (!source || typeof reputation !== 'number') {
            res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
            res.end(JSON.stringify({ error: 'Valid source name and numeric reputation (0.0-1.0) required' }));
            return true;
          }
          setSourceReputation(source, reputation);
          res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ success: true, reputations: getAllSourceReputations() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...secureHeaders() });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return true;
    }

    // ── Global 3D Threat Globe Coordinate Telemetry API ────────────────
    if (url === '/api/threat-map') {
      try {
        const { initDb } = require('../../db');
        const database = initDb();
        const victims = database.prepare('SELECT victim_name, group_name, country, sector, discovered_at FROM ransomware_victims ORDER BY discovered_at DESC LIMIT 30').all();

        // Standard country lat/long centroid mapping
        const countryCoords = {
          'US': { lat: 37.09, lon: -95.71, name: 'United States' },
          'GB': { lat: 55.37, lon: -3.43, name: 'United Kingdom' },
          'DE': { lat: 51.16, lon: 10.45, name: 'Germany' },
          'FR': { lat: 46.22, lon: 2.21, name: 'France' },
          'IN': { lat: 20.59, lon: 78.96, name: 'India' },
          'CA': { lat: 56.13, lon: -106.34, name: 'Canada' },
          'AU': { lat: -25.27, lon: 133.77, name: 'Australia' },
          'JP': { lat: 36.20, lon: 138.25, name: 'Japan' },
          'BR': { lat: -14.23, lon: -51.92, name: 'Brazil' },
          'IT': { lat: 41.87, lon: 12.56, name: 'Italy' },
          'ES': { lat: 40.46, lon: -3.74, name: 'Spain' },
          'NL': { lat: 52.13, lon: 5.29, name: 'Netherlands' }
        };

        const mapNodes = victims.map((v) => {
          const code = (v.country || 'US').toUpperCase();
          const coords = countryCoords[code] || countryCoords['US'];
          return {
            target: v.victim_name || 'Enterprise Target',
            threatActor: v.group_name || 'Ransomware Group',
            sector: v.sector || 'Commercial',
            country: coords.name,
            lat: coords.lat + (Math.random() * 2 - 1),
            lon: coords.lon + (Math.random() * 2 - 1),
            timestamp: v.discovered_at
          };
        });

        if (mapNodes.length === 0 && isDemoMode()) {
          const sampleThreats = [
            { target: 'Financial Core Banking Perimeter', threatActor: 'LockBit 3.0', sector: 'Finance', country: 'United States', lat: 38.89, lon: -77.03, timestamp: new Date().toISOString() },
            { target: 'Global Logistics Gateway Node', threatActor: 'RansomHub', sector: 'Logistics', country: 'United Kingdom', lat: 51.50, lon: -0.12, timestamp: new Date().toISOString() },
            { target: 'Automotive Manufacturing Plant', threatActor: 'BlackCat', sector: 'Manufacturing', country: 'Germany', lat: 52.52, lon: 13.40, timestamp: new Date().toISOString() },
            { target: 'Telecommunications Carrier', threatActor: 'Volt Typhoon', sector: 'Telecom', country: 'Australia', lat: -33.86, lon: 151.20, timestamp: new Date().toISOString() },
            { target: 'Energy Dispatch Grid Systems', threatActor: 'Akira', sector: 'Energy', country: 'France', lat: 48.85, lon: 2.35, timestamp: new Date().toISOString() },
            { target: 'Cloud Infrastructure Provider', threatActor: 'Play Ransomware', sector: 'Technology', country: 'Japan', lat: 35.67, lon: 139.65, timestamp: new Date().toISOString() }
          ];
          mapNodes.push(...sampleThreats);
        }

        res.writeHead(200, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ count: mapNodes.length, nodes: mapNodes }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...secureHeaders() });
        res.end(JSON.stringify({ error: err.message }));
      }
      return true;
    }


  return false;
}

module.exports = { handleIntelRoutes };
