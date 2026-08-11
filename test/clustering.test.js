const test = require('node:test');
const assert = require('node:assert/strict');
const { clusterArticles, fuseStoryCluster } = require('../src/story-clusterer');
const { formatArticle, formatArticleForTelegram } = require('../src/formatter');

test('clusterArticles - groups similar articles by cosine similarity and CVE ID', () => {
  const articles = [
    {
      title: 'Massive Ransomware Outage Hits Critical Infrastructure',
      description: 'Attackers leveraged CVE-2024-30078 to encrypt hospital database servers.',
      source: 'BleepingComputer',
      url: 'https://bleepingcomputer.com/ransomware-outage'
    },
    {
      title: 'CVE-2024-30078 Exploited in Hospital Ransomware Wave',
      description: 'Healthcare systems locked as threat group deploys encryption payload.',
      source: 'The Hacker News',
      url: 'https://thehackernews.com/cve-2024-30078-exploit'
    },
    {
      title: 'New Open Source Framework Released for Quantum Research',
      description: 'Scientists announce quantum simulation benchmark tool.',
      source: 'TechCrunch',
      url: 'https://techcrunch.com/quantum-benchmark'
    }
  ];

  const { singleArticles, clusters } = clusterArticles(articles, 0.4);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].memberArticles.length, 2);
  assert.equal(clusters[0].sources.length, 2);
  assert.ok(clusters[0].sources.includes('BleepingComputer'));
  assert.ok(clusters[0].sources.includes('The Hacker News'));

  assert.equal(singleArticles.length, 1);
  assert.equal(singleArticles[0].source, 'TechCrunch');
});

test('fuseStoryCluster - synthesizes master bulletin summary with multi-source metadata', async () => {
  const cluster = {
    primaryArticle: {
      title: 'Zero-day Exploit in Firewalls Detected',
      source: 'SecurityWeek',
      url: 'https://securityweek.com/firewall-0day'
    },
    memberArticles: [
      {
        title: 'Zero-day Exploit in Firewalls Detected',
        description: 'Vendor releases emergency patch for critical zero-day flaw.',
        source: 'SecurityWeek',
        url: 'https://securityweek.com/firewall-0day'
      },
      {
        title: 'Active Exploitation of Enterprise Firewalls Reported',
        description: 'State-sponsored hackers actively scanning and compromising unpatched appliances.',
        source: 'KrebsOnSecurity',
        url: 'https://krebsonsecurity.com/firewall-active-exploit'
      }
    ],
    sources: ['SecurityWeek', 'KrebsOnSecurity'],
    sourceLinks: [
      { source: 'SecurityWeek', url: 'https://securityweek.com/firewall-0day' },
      { source: 'KrebsOnSecurity', url: 'https://krebsonsecurity.com/firewall-active-exploit' }
    ]
  };

  const { fusedArticle, summary } = await fuseStoryCluster(cluster);

  assert.ok(fusedArticle.title.includes('MASTER BULLETIN'));
  assert.equal(fusedArticle.sources.length, 2);
  assert.ok(summary.includes('SecurityWeek') || summary.includes('KrebsOnSecurity'));

  // Test formatters
  const wa = formatArticle(fusedArticle, summary, false);
  assert.ok(wa.includes('MASTER BULLETIN'));
  assert.ok(wa.includes('All Reporting Sources:'));
  assert.ok(wa.includes('SecurityWeek'));
  assert.ok(wa.includes('KrebsOnSecurity'));

  const tg = formatArticleForTelegram(fusedArticle, summary, false);
  assert.ok(tg.includes('MASTER BULLETIN'));
  assert.ok(tg.includes('All Reporting Sources:'));
});
