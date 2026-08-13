import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeFilterCount,
  annotateIdiom,
  classifyFrequency,
  createEmptyGlobalRules,
  filterIdioms,
  matchesAnySyllable,
  matchesRule,
  normalizePhoneticInput,
  stripTone,
} from './filter-engine.js';

test('stripTone preserves ü while removing tone marks', () => {
  assert.equal(stripTone('ǚ iān ài'), 'ü ian ai');
});

test('annotateIdiom returns per-position phonetic components', () => {
  const entry = annotateIdiom('画龙点睛');
  assert.equal(entry.length, 4);
  assert.deepEqual(entry.syllables.map((item) => item.initial), ['h', 'l', 'd', 'j']);
  assert.deepEqual(entry.syllables.map((item) => item.tone), ['4', '2', '3', '1']);
  assert.deepEqual(entry.syllables.map((item) => item.final), ['ua', 'ong', 'ian', 'ing']);
});

test('position rule combines character, initial, final and tone', () => {
  const entry = annotateIdiom('画龙点睛');
  assert.equal(matchesRule(entry, { character: '龙', initial: 'l', final: 'ong', tone: '2' }, 1), true);
  assert.equal(matchesRule(entry, { character: '', initial: 'l', final: 'ong', tone: '3' }, 1), false);
});

test('zero-initial rule matches syllables without an initial', () => {
  const entry = annotateIdiom('阿鼻地狱');
  assert.equal(matchesRule(entry, { character: '', initial: '_zero', final: 'a', tone: '1' }, 0), true);
  assert.equal(matchesRule(entry, { character: '', initial: '_zero', final: 'i', tone: '1' }, 0), false);
});

test('phonetic text input accepts common ü and zero-initial aliases', () => {
  assert.equal(normalizePhoneticInput('final', ' VAN '), 'üan');
  assert.equal(normalizePhoneticInput('final', 'u:e'), 'üe');
  assert.equal(normalizePhoneticInput('final', 'üan'), 'üan');
  assert.equal(normalizePhoneticInput('final', 'uan'), 'uan');
  assert.equal(normalizePhoneticInput('initial', '∅'), '_zero');
  assert.equal(normalizePhoneticInput('initial', ' ZH '), 'zh');
});

test('v means ü while u searches both u and ü finals', () => {
  const umlautEntry = annotateIdiom('女中豪杰');
  const uEntry = annotateIdiom('路不拾遗');
  assert.equal(umlautEntry.syllables[0].final, 'ü');
  assert.equal(uEntry.syllables[0].final, 'u');

  const vFinal = normalizePhoneticInput('final', 'v');
  assert.equal(vFinal, 'ü');
  assert.equal(matchesRule(umlautEntry, { character: '', initial: 'n', final: vFinal, tone: '3' }, 0), true);
  assert.equal(matchesRule(uEntry, { character: '', initial: 'l', final: vFinal, tone: '4' }, 0), false);

  const uFinal = normalizePhoneticInput('final', 'u');
  assert.equal(matchesAnySyllable(umlautEntry, { initial: '', final: uFinal }), true);
  assert.equal(matchesAnySyllable(uEntry, { initial: '', final: uFinal }), true);
});

test('keyword u also finds pinyin ü while v remains an ü alias', () => {
  const corpus = ['女中豪杰', '路不拾遗'].map(annotateIdiom);
  const baseOptions = { length: 4, rules: [], globalRules: createEmptyGlobalRules() };
  assert.deepEqual(filterIdioms(corpus, { ...baseOptions, keyword: 'nu' }).map((item) => item.word), ['女中豪杰']);
  assert.deepEqual(filterIdioms(corpus, { ...baseOptions, keyword: 'nv' }).map((item) => item.word), ['女中豪杰']);
  assert.deepEqual(filterIdioms(corpus, { ...baseOptions, keyword: 'lu' }).map((item) => item.word), ['路不拾遗']);
});

test('global filters start with four include and six exclude rows', () => {
  const globalRules = createEmptyGlobalRules();
  assert.equal(globalRules.include.length, 4);
  assert.equal(globalRules.exclude.length, 6);
  assert.equal(globalRules.include.every((condition) => !condition.initial && !condition.final), true);
  assert.equal(globalRules.exclude.every((condition) => !condition.initial && !condition.final), true);
});

test('frequency thresholds map to stable commonness levels', () => {
  assert.equal(classifyFrequency(100), 'high');
  assert.equal(classifyFrequency(99), 'common');
  assert.equal(classifyFrequency(20), 'common');
  assert.equal(classifyFrequency(19), 'less');
  assert.equal(classifyFrequency(4), 'less');
  assert.equal(classifyFrequency(3), 'rare');
  assert.equal(classifyFrequency(0), 'rare');
  assert.equal(annotateIdiom('一心一意').commonness, 'high');
});

test('commonness filter selects the requested frequency tier', () => {
  const corpus = ['一心一意', '画龙点睛'].map(annotateIdiom);
  const results = filterIdioms(corpus, {
    length: 4,
    keyword: '',
    rules: [],
    globalRules: createEmptyGlobalRules(),
    commonness: 'high',
  });
  assert.deepEqual(results.map((item) => item.word), ['一心一意']);
});

test('whole-idiom condition uses OR between initial and final', () => {
  const dragon = annotateIdiom('画龙点睛');
  assert.equal(matchesAnySyllable(dragon, { initial: 'l', final: 'ong' }), true);
  assert.equal(matchesAnySyllable(dragon, { initial: 'l', final: 'ao' }), true);
  assert.equal(matchesAnySyllable(dragon, { initial: 'x', final: 'ing' }), true);
  assert.equal(matchesAnySyllable(dragon, { initial: 'x', final: 'ao' }), false);
  assert.equal(matchesAnySyllable(dragon, { initial: '', final: 'ing' }), true);
  assert.equal(matchesAnySyllable(dragon, { initial: '_zero', final: '' }), false);
});

test('global include and exclude conditions filter the whole idiom', () => {
  const corpus = ['画龙点睛', '画蛇添足', '龙飞凤舞'].map(annotateIdiom);
  const results = filterIdioms(corpus, {
    length: 4,
    keyword: '',
    rules: [],
    globalRules: {
      include: [{ initial: '', final: 'ong' }],
      exclude: [{ initial: 'd', final: 'ian' }],
    },
  });
  assert.deepEqual(results.map((item) => item.word), ['龙飞凤舞']);
});

test('multiple include rules are all required and multiple excludes use any-match', () => {
  const corpus = ['画龙点睛', '龙飞凤舞', '画蛇添足'].map(annotateIdiom);
  const included = filterIdioms(corpus, {
    length: 4,
    keyword: '',
    rules: [],
    globalRules: {
      include: [{ initial: 'l', final: 'ong' }, { initial: 'j', final: 'ing' }],
      exclude: [{ initial: '', final: 'ao' }, { initial: 'sh', final: 'e' }],
    },
  });
  assert.deepEqual(included.map((item) => item.word), ['画龙点睛']);

  const excluded = filterIdioms(corpus, {
    length: 4,
    keyword: '',
    rules: [],
    globalRules: {
      include: [{ initial: '', final: '' }],
      exclude: [{ initial: 'f', final: 'ei' }, { initial: 'sh', final: 'e' }],
    },
  });
  assert.deepEqual(excluded.map((item) => item.word), ['画龙点睛']);
});

test('filterIdioms combines length, keyword and position rules', () => {
  const corpus = ['画龙点睛', '龙飞凤舞', '画蛇添足'].map(annotateIdiom);
  const results = filterIdioms(corpus, {
    length: 4,
    keyword: '画',
    rules: [
      { character: '', initial: 'h', final: 'ua', tone: '4' },
      { character: '', initial: '', final: '', tone: '' },
      { character: '', initial: 'd', final: '', tone: '' },
      { character: '', initial: '', final: '', tone: '' },
    ],
  });
  assert.deepEqual(results.map((item) => item.word), ['画龙点睛']);
  assert.equal(activeFilterCount([{ character: '', initial: 'h', final: 'ua', tone: '4' }], '画'), 4);
});

test('keyword accepts compact pinyin without tones or spaces', () => {
  const corpus = ['画龙点睛', '画蛇添足'].map(annotateIdiom);
  const results = filterIdioms(corpus, { length: 4, keyword: 'hualong', rules: [] });
  assert.deepEqual(results.map((item) => item.word), ['画龙点睛']);
});

test('fewer than 50 results are sorted by frequency without changing the filter', () => {
  const corpus = [
    { word: '低频词', frequency: 2 },
    { word: '高频词', frequency: 200 },
    { word: '中频词', frequency: 20 },
  ].map((entry) => ({
    ...entry,
    length: 3,
    commonness: 'common',
    pinyin: '',
    syllables: [],
  }));

  const results = filterIdioms(corpus, { length: 3, keyword: '', rules: [] });
  assert.deepEqual(results.map((item) => item.word), ['高频词', '中频词', '低频词']);
});

test('50 results keep the corpus order', () => {
  const corpus = Array.from({ length: 50 }, (_, index) => ({
    word: `词${String(index).padStart(2, '0')}`,
    length: 3,
    frequency: index,
    commonness: 'common',
    pinyin: '',
    syllables: [],
  }));

  const results = filterIdioms(corpus, { length: 3, keyword: '', rules: [] });
  assert.deepEqual(results.map((item) => item.word), corpus.map((item) => item.word));
});
