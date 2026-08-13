import idiomSearch from 'cnchar-idiom';
import { pinyin } from 'pinyin-pro';
import idiomFrequency from './idiom-frequency.generated.js';

const TONE_MARKS = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a',
  ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i',
  ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u',
  ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü',
};

export const INITIALS = [
  '', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h',
  'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w',
];

export const FINALS = [
  'a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'er',
  'i', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong',
  'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ong',
  'ü', 'üe', 'üan', 'ün',
];

export const COMMONNESS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'high', label: '高频' },
  { value: 'common', label: '常见' },
  { value: 'less', label: '较少见' },
  { value: 'rare', label: '低频 / 未收录' },
];

export function classifyFrequency(frequency = 0) {
  if (frequency >= 100) return 'high';
  if (frequency >= 20) return 'common';
  if (frequency >= 4) return 'less';
  return 'rare';
}

export function stripTone(value = '') {
  return [...value].map((character) => TONE_MARKS[character] ?? character).join('');
}

function normalizeUmlaut(value = '') {
  return value.replaceAll('u:', '\u00fc').replaceAll('v', '\u00fc');
}

function finalMatchesInput(actualFinal, inputFinal) {
  return actualFinal === inputFinal
    || (inputFinal.includes('u') && actualFinal === inputFinal.replaceAll('u', '\u00fc'));
}

export function createEmptyRule() {
  return { character: '', initial: '', final: '', tone: '' };
}

export function createEmptyGlobalRules() {
  return {
    include: Array.from({ length: 4 }, () => ({ initial: '', final: '' })),
    exclude: Array.from({ length: 6 }, () => ({ initial: '', final: '' })),
  };
}

export function normalizePhoneticInput(field, value = '') {
  const normalized = value.trim().toLowerCase();
  if (field === 'initial' && ['零声母', '零', '0', '∅'].includes(normalized)) return '_zero';
  if (field === 'final') return normalizeUmlaut(normalized);
  return normalized;
}

export function annotateIdiom(word) {
  const sounds = pinyin(word, { type: 'all', toneSandhi: false, segmentit: 2 });
  const frequency = idiomFrequency[word] || 0;
  return {
    word,
    length: [...word].length,
    frequency,
    commonness: classifyFrequency(frequency),
    pinyin: sounds.map((sound) => sound.pinyin).join(' '),
    syllables: sounds.map((sound) => ({
      character: sound.origin,
      pinyin: sound.pinyin,
      initial: sound.initial,
      final: stripTone(sound.final),
      tone: String(sound.num || 0),
    })),
  };
}

let cachedCorpus;

export function loadCorpus() {
  if (cachedCorpus) return cachedCorpus;
  const uniqueWords = [...new Set(idiomSearch([]))]
    .filter((word) => /^[\u3400-\u9fff]+$/u.test(word));
  cachedCorpus = uniqueWords.map(annotateIdiom);
  return cachedCorpus;
}

export function ruleIsActive(rule) {
  return Boolean(rule?.character || rule?.initial || rule?.final || rule?.tone);
}

export function matchesRule(entry, rule, position) {
  if (!ruleIsActive(rule)) return true;
  const syllable = entry.syllables[position];
  if (!syllable) return false;
  return (!rule.character || syllable.character === rule.character)
    && (!rule.initial || (rule.initial === '_zero' ? syllable.initial === '' : syllable.initial === rule.initial))
    && (!rule.final || finalMatchesInput(syllable.final, rule.final))
    && (!rule.tone || syllable.tone === rule.tone);
}

export function matchesAnySyllable(entry, { initial = '', final = '' }) {
  if (!initial && !final) return false;
  return entry.syllables.some((syllable) => {
    const initialMatches = initial
      && (initial === '_zero' ? syllable.initial === '' : syllable.initial === initial);
    const finalMatches = final && finalMatchesInput(syllable.final, final);
    return Boolean(initialMatches || finalMatches);
  });
}

function activeGlobalConditions(conditions = []) {
  return conditions.filter((condition) => condition.initial || condition.final);
}

export function filterIdioms(corpus, { length, keyword, rules, globalRules = {}, commonness = 'all' }) {
  const cleanKeyword = normalizeUmlaut(stripTone(keyword.trim().toLowerCase()));
  const compactKeyword = cleanKeyword.replaceAll(' ', '');
  const includeConditions = activeGlobalConditions(globalRules.include);
  const excludeConditions = activeGlobalConditions(globalRules.exclude);
  const filtered = corpus.filter((entry) => {
    if (length && entry.length !== length) return false;
    if (commonness !== 'all' && entry.commonness !== commonness) return false;
    if (cleanKeyword) {
      const plainPinyin = stripTone(entry.pinyin).toLowerCase();
      const umlautKeyword = cleanKeyword.includes('u') ? cleanKeyword.replaceAll('u', '\u00fc') : cleanKeyword;
      const compactUmlautKeyword = umlautKeyword.replaceAll(' ', '');
      if (!entry.word.includes(cleanKeyword)
        && !plainPinyin.includes(cleanKeyword)
        && !plainPinyin.replaceAll(' ', '').includes(compactKeyword)
        && !plainPinyin.includes(umlautKeyword)
        && !plainPinyin.replaceAll(' ', '').includes(compactUmlautKeyword)) return false;
    }
    if (!includeConditions.every((condition) => matchesAnySyllable(entry, condition))) return false;
    if (excludeConditions.some((condition) => matchesAnySyllable(entry, condition))) return false;
    return rules.every((rule, position) => matchesRule(entry, rule, position));
  });

  if (filtered.length < 50) {
    return [...filtered].sort((left, right) =>
      (right.frequency ?? 0) - (left.frequency ?? 0)
      || left.word.localeCompare(right.word, 'zh-CN'));
  }

  return filtered;
}

export function activeFilterCount(rules, keyword = '', globalRules = {}, commonness = 'all') {
  const globalCount = [...(globalRules.include || []), ...(globalRules.exclude || [])]
    .reduce((count, condition) => count + Number(Boolean(condition.initial || condition.final)), 0);
  return rules.reduce((count, rule) => count
    + ['character', 'initial', 'final', 'tone'].filter((key) => rule[key]).length, 0)
    + globalCount
    + Number(commonness !== 'all')
    + (keyword.trim() ? 1 : 0);
}
