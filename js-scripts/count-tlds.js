// Quick TLD counter script
const fs = require('fs');

const code = fs.readFileSync('background.js', 'utf8');
const match = code.match(/const commonTLDs = \[([\s\S]*?)\];/);

if (match) {
  const content = match[1];
  const tlds = content
    .split(',')
    .map(s => s.trim())
    .map(s => s.replace(/^['"]/, '').replace(/['"]$/, ''))
    .filter(s => s && !s.startsWith('//'));

  console.log('Total TLDs:', tlds.length);
  console.log('\nCategories:');
  console.log('- Generic TLDs (gTLD):', tlds.filter(t => !t.includes('.')).slice(0, 20).length + ' (estimated)');
  console.log('- Multi-part TLDs:', tlds.filter(t => t.includes('.')).length);
  console.log('\nSample new gTLDs:', tlds.filter(t => ['app', 'dev', 'io', 'cloud', 'tech', 'ai'].includes(t)).join(', '));
  console.log('\nSample ccTLDs:', tlds.filter(t => ['ca', 'mx', 'sg', 'ae', 'za'].includes(t)).join(', '));
  console.log('\nSample multi-part:', tlds.filter(t => t.includes('.')).slice(0, 10).join(', '));
}
