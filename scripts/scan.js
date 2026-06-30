const fs = require('fs');
const path = require('path');

const files = [
  'index.js','add-source.js','list-groups.js','list-telegram-chats.js',
  'src/sender.js','src/telegram-sender.js','src/discord-sender.js',
  'src/pipeline.js','src/fetcher.js','src/summarizer.js',
  'src/formatter.js','src/scorer.js','src/deduplicator.js',
  'src/web-dashboard.js','src/logger.js'
];

const patterns = [
  ['eval()',         /\beval\s*\(/g,          'CRITICAL', 'Remote code execution risk'],
  ['new Function()', /new\s+Function\s*\(/g,  'CRITICAL', 'Remote code execution risk'],
  ['__proto__',      /__proto__/g,            'HIGH',     'Prototype pollution'],
  ['JSON.parse',     /JSON\.parse\s*\(\s*(?!.*\btry\b)/g, 'MEDIUM', 'Check JSON.parse has try/catch nearby'],
  ['http:// url',    /['"]http:\/\/(?!localhost)[a-z0-9.-]+/gi, 'LOW', 'Unencrypted HTTP endpoint'],
];

let totalIssues = 0;
const results = [];

files.forEach(f => {
  const fullPath = path.join(process.cwd(), f);
  if (!fs.existsSync(fullPath)) return;
  const src = fs.readFileSync(fullPath, 'utf-8');
  const lines = src.split('\n');

  patterns.forEach(([name, regex, severity, desc]) => {
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(src)) !== null) {
      const upTo = src.slice(0, m.index);
      const lineNum = upTo.split('\n').length;
      const lineContent = lines[lineNum - 1] ? lines[lineNum - 1].trim().slice(0, 90) : '';
      results.push({ severity, file: f, line: lineNum, issue: name, desc, content: lineContent });
      totalIssues++;
    }
  });
});

const order = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 };
results.sort((a,b) => order[a.severity] - order[b.severity]);

if (results.length === 0) {
  console.log('All clear — no static security issues found.');
} else {
  results.forEach(r => {
    console.log('[' + r.severity + '] ' + r.file + ':' + r.line + ' -- ' + r.issue + ': ' + r.desc);
    if (r.content) console.log('       ' + r.content);
  });
  console.log('\nTotal: ' + totalIssues + ' potential issues (review each — many may be false positives)');
}
