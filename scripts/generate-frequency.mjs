import fs from 'node:fs';
import path from 'node:path';
import idiomSearch from 'cnchar-idiom';

const dictionaryPath = process.argv[2];
if (!dictionaryPath || !fs.existsSync(dictionaryPath)) {
  throw new Error('请传入 jieba dict.txt 或 dict.txt.big 的路径');
}

const frequencies = {};
const idioms = new Set(idiomSearch([]));
const source = fs.readFileSync(dictionaryPath, 'utf8');
for (const line of source.split(/\r?\n/)) {
  const [word, rawFrequency] = line.trim().split(/\s+/);
  const frequency = Number(rawFrequency);
  if (idioms.has(word) && frequency > 3) frequencies[word] = frequency;
}

const sorted = Object.fromEntries(Object.entries(frequencies).sort(([left], [right]) => left.localeCompare(right, 'zh-CN')));
const outputPath = path.resolve('src/idiom-frequency.generated.js');
const banner = '// Generated from jieba dictionary frequencies. Values <= 3 are intentionally omitted.\n';
fs.writeFileSync(outputPath, `${banner}export default ${JSON.stringify(sorted)};\n`, 'utf8');
console.log(`Generated ${Object.keys(sorted).length} frequency entries at ${outputPath}`);
