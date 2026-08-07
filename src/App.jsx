import { useDeferredValue, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Download,
  Eraser,
  Filter,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  activeFilterCount,
  createEmptyGlobalRules,
  createEmptyRule,
  filterIdioms,
  COMMONNESS_OPTIONS,
  loadCorpus,
  normalizePhoneticInput,
} from './filter-engine.js';

const PAGE_SIZE = 48;
const COMMONNESS_LABELS = Object.fromEntries(COMMONNESS_OPTIONS.map((option) => [option.value, option.label]));
const TONES = [
  { value: '1', label: '一声', mark: 'ˉ' },
  { value: '2', label: '二声', mark: 'ˊ' },
  { value: '3', label: '三声', mark: 'ˇ' },
  { value: '4', label: '四声', mark: 'ˋ' },
  { value: '0', label: '轻声', mark: '·' },
];

const EXAMPLE_RULES = [
  { character: '', initial: 'h', final: 'ua', tone: '4' },
  { character: '', initial: 'l', final: 'ong', tone: '2' },
  { character: '', initial: 'd', final: 'ian', tone: '3' },
  { character: '', initial: 'j', final: 'ing', tone: '1' },
];

function PositionFilter({ index, rule, onChange, onClear }) {
  const summary = [
    rule.character && `字 ${rule.character}`,
    rule.initial && (rule.initial === '_zero' ? '零声母' : `声母 ${rule.initial}`),
    rule.final && `韵母 ${rule.final}`,
    rule.tone && `${rule.tone === '0' ? '轻声' : `${rule.tone} 声`}`,
  ].filter(Boolean).join(' · ');

  return (
    <section className={`position-card ${summary ? 'is-active' : ''}`} aria-label={`第 ${index + 1} 个字的筛选条件`}>
      <div className="position-head">
        <div className="position-title">
          <span className="position-number">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>第 {index + 1} 字位</h3>
            <p>{summary || '不限读音与汉字'}</p>
          </div>
        </div>
        {summary && (
          <button className="icon-button subtle" type="button" onClick={onClear} aria-label={`清除第 ${index + 1} 字位`}>
            <X size={16} />
          </button>
        )}
      </div>

      <div className="filter-grid">
        <label className="field character-field">
          <span>指定汉字</span>
          <input
            value={rule.character}
            maxLength={1}
            inputMode="text"
            placeholder="任意"
            onChange={(event) => onChange('character', [...event.target.value].slice(0, 1).join(''))}
          />
        </label>
        <label className="field">
          <span>声母</span>
          <input
            value={rule.initial === '_zero' ? '零声母' : rule.initial}
            placeholder="如 zh"
            autoComplete="off"
            spellCheck="false"
            onChange={(event) => onChange('initial', event.target.value)}
          />
        </label>
        <label className="field">
          <span>韵母</span>
          <input
            value={rule.final}
            placeholder="如 ang / ü"
            autoComplete="off"
            spellCheck="false"
            onChange={(event) => onChange('final', event.target.value)}
          />
        </label>
      </div>

      <div className="tone-row" aria-label="声调">
        <span className="tone-label">声调</span>
        {TONES.map((tone) => (
          <button
            key={tone.value}
            type="button"
            className={rule.tone === tone.value ? 'tone-button selected' : 'tone-button'}
            onClick={() => onChange('tone', rule.tone === tone.value ? '' : tone.value)}
            title={tone.label}
            aria-pressed={rule.tone === tone.value}
          >
            <span>{tone.mark}</span>{tone.value === '0' ? '轻' : tone.value}
          </button>
        ))}
      </div>
    </section>
  );
}

function GlobalPhoneticFilters({ value, onChange, onAdd, onRemove, onClear }) {
  const active = [...value.include, ...value.exclude].some((condition) => condition.initial || condition.final);

  const renderGroup = (group, title, description, badge) => (
    <div className={`global-condition-group ${group}-group`}>
      <div className="global-group-head">
        <div className="global-rule-label"><b>{badge}</b><span><strong>{title}</strong>{description}</span></div>
        <button type="button" onClick={() => onAdd(group)} aria-label={`添加${title}条件`}><Plus size={12} /> 添加</button>
      </div>
      {value[group].map((condition, index) => (
        <div className="global-condition-row" key={`${group}-${index}`}>
          <span className="condition-index">{index + 1}</span>
          <label className="global-phonetic-field">
            <span>声母</span>
            <input
              value={condition.initial === '_zero' ? '零声母' : condition.initial}
              placeholder="如 l"
              autoComplete="off"
              spellCheck="false"
              aria-label={`全成语${title}第${index + 1}组声母`}
              onChange={(event) => onChange(group, index, 'initial', event.target.value)}
            />
          </label>
          <label className="global-phonetic-field">
            <span>韵母</span>
            <input
              value={condition.final}
              placeholder="如 ong"
              autoComplete="off"
              spellCheck="false"
              aria-label={`全成语${title}第${index + 1}组韵母`}
              onChange={(event) => onChange(group, index, 'final', event.target.value)}
            />
          </label>
          <button
            className="remove-condition"
            type="button"
            onClick={() => onRemove(group, index)}
            disabled={value[group].length === 1}
            aria-label={`删除${title}第${index + 1}组`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <section className={`global-phonetic-card ${active ? 'is-active' : ''}`} aria-label="全成语范围筛选">
      <div className="global-phonetic-head">
        <div><strong>全成语范围</strong><span>每组声母、韵母任一命中即可</span></div>
        {active && <button type="button" onClick={onClear}><Eraser size={13} /> 清空</button>}
      </div>
      {renderGroup('include', '包含', '每组都需命中', '含')}
      {renderGroup('exclude', '排除', '命中任一即剔除', '排')}
    </section>
  );
}

function IdiomCard({ entry, selected, onSelect, onCopy }) {
  return (
    <article className={`idiom-card ${selected ? 'selected' : ''}`}>
      <button className="idiom-main" type="button" onClick={onSelect}>
        <div className="word-row">
          <h3>{entry.word}</h3>
          <ChevronRight size={17} />
        </div>
        <p className="pinyin-line">{entry.pinyin}</p>
      </button>
      <button className="copy-button" type="button" onClick={onCopy} aria-label={`复制${entry.word}`}>
        <Clipboard size={15} />
      </button>
    </article>
  );
}

function EmptyState({ onReset }) {
  return (
    <div className="empty-state">
      <div className="empty-glyph">未</div>
      <h3>没有找到相符成语</h3>
      <p>试着减少一个字位的条件，或检查 ü、轻声与多音字读法。</p>
      <button className="secondary-button" type="button" onClick={onReset}><RotateCcw size={16} /> 重置条件</button>
    </div>
  );
}

export default function App() {
  const corpus = useMemo(() => loadCorpus(), []);
  const lengths = useMemo(() => [...new Set(corpus.map((entry) => entry.length))].sort((a, b) => a - b), [corpus]);
  const visibleLengths = lengths.filter((length) => length >= 3 && length <= 12);
  const [length, setLength] = useState(4);
  const [keyword, setKeyword] = useState('');
  const [commonness, setCommonness] = useState('all');
  const [rules, setRules] = useState(() => Array.from({ length: 4 }, createEmptyRule));
  const [globalRules, setGlobalRules] = useState(createEmptyGlobalRules);
  const [page, setPage] = useState(1);
  const [selectedWord, setSelectedWord] = useState('');
  const [notice, setNotice] = useState('');
  const deferredKeyword = useDeferredValue(keyword);

  const results = useMemo(() => filterIdioms(corpus, {
    length,
    keyword: deferredKeyword,
    rules,
    globalRules,
    commonness,
  }), [corpus, length, deferredKeyword, rules, globalRules, commonness]);

  const selectedEntry = results.find((entry) => entry.word === selectedWord) || results[0];
  const filterCount = activeFilterCount(rules, keyword, globalRules, commonness);

  const changeLength = (nextLength) => {
    const parsed = Number(nextLength);
    setLength(parsed);
    setRules((current) => Array.from({ length: parsed }, (_, index) => current[index] || createEmptyRule()));
    setPage(1);
    setSelectedWord('');
  };

  const updateRule = (position, field, value) => {
    setRules((current) => current.map((rule, index) => {
      if (index !== position) return rule;
      return {
        ...rule,
        [field]: normalizePhoneticInput(field, value),
      };
    }));
    setPage(1);
  };

  const updateGlobalRule = (group, index, field, value) => {
    setGlobalRules((current) => ({
      ...current,
      [group]: current[group].map((condition, conditionIndex) => conditionIndex === index
        ? { ...condition, [field]: normalizePhoneticInput(field, value) }
        : condition),
    }));
    setPage(1);
  };

  const addGlobalRule = (group) => {
    setGlobalRules((current) => ({
      ...current,
      [group]: [...current[group], { initial: '', final: '' }],
    }));
  };

  const removeGlobalRule = (group, index) => {
    setGlobalRules((current) => ({
      ...current,
      [group]: current[group].length === 1
        ? current[group]
        : current[group].filter((_, conditionIndex) => conditionIndex !== index),
    }));
    setPage(1);
  };

  const actualResults = results;
  const displayed = actualResults.slice(0, page * PAGE_SIZE);

  const reset = () => {
    setKeyword('');
    setLength(4);
    setCommonness('all');
    setRules(Array.from({ length: 4 }, createEmptyRule));
    setGlobalRules(createEmptyGlobalRules());
    setPage(1);
    setSelectedWord('');
  };

  const fillExample = () => {
    setKeyword('');
    setLength(4);
    setCommonness('all');
    setRules(EXAMPLE_RULES);
    setGlobalRules(createEmptyGlobalRules());
    setPage(1);
    setSelectedWord('画龙点睛');
  };

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 1800);
  };

  const copyEntry = async (entry) => {
    const text = `${entry.word}  ${entry.pinyin}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    showNotice(`已复制「${entry.word}」`);
  };

  const exportResults = () => {
    const header = '成语,拼音,分位声韵调';
    const rows = actualResults.map((entry) => {
      const details = entry.syllables.map((item) => `${item.character}:${item.initial || '零声母'}/${item.final}/${item.tone}`).join(' | ');
      return `"${entry.word}","${entry.pinyin}","${details}"`;
    });
    const blob = new Blob([`\ufeff${[header, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `成语筛选结果-${actualResults.length}条.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    showNotice(`已导出 ${actualResults.length} 条结果`);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="成语高手首页">
          <span className="seal">语</span>
          <span><b>成语高手</b><small>PINYIN FILTER STUDIO</small></span>
        </a>
        <div className="source-note"><span className="status-dot" /> 离线词库 · {corpus.length.toLocaleString()} 条</div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> 把读音拆开，答案自然浮现</span>
            <h1>按每个字的<br /><em>声 · 韵 · 调</em> 找成语</h1>
            <p>每一个位置都能独立指定汉字、声母、韵母与声调。条件自由叠加，结果即时筛出。</p>
          </div>
          <div className="hero-example" aria-label="功能示例">
            <div className="example-heading"><span>示例</span><button type="button" onClick={fillExample}>填入条件 <ChevronRight size={14} /></button></div>
            <div className="example-word">
              {['画', '龙', '点', '睛'].map((character, index) => (
                <div key={character}><b>{character}</b><span>{['huà', 'lóng', 'diǎn', 'jīng'][index]}</span></div>
              ))}
            </div>
            <p>h · ua · 4　/　l · ong · 2　/　d · ian · 3　/　j · ing · 1</p>
          </div>
        </section>

        <section className="workspace">
          <aside className="filter-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">FILTER BUILDER</span><h2><SlidersHorizontal size={20} /> 筛选条件</h2></div>
              <button className="text-button" type="button" onClick={reset}><RotateCcw size={15} /> 重置</button>
            </div>

            <div className="global-filters">
              <label className="search-field">
                <Search size={18} />
                <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="搜索汉字或无调拼音…" />
                {keyword && <button type="button" onClick={() => setKeyword('')} aria-label="清空搜索"><X size={15} /></button>}
              </label>
              <label className="length-field">
                <span>字数</span>
                <select value={length} onChange={(event) => changeLength(event.target.value)}>
                  {visibleLengths.map((item) => <option key={item} value={item}>{item} 字</option>)}
                </select>
              </label>
              <label className="length-field commonness-field">
                <span>常用度</span>
                <select value={commonness} aria-label="常用程度" title="基于 jieba 语料词频的近似分级" onChange={(event) => { setCommonness(event.target.value); setPage(1); }}>
                  {COMMONNESS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <div className="filter-tip"><CircleHelp size={16} /><span>全成语条件先筛词条；下方字位条件再按固定位置匹配。</span></div>

            <GlobalPhoneticFilters
              value={globalRules}
              onChange={updateGlobalRule}
              onAdd={addGlobalRule}
              onRemove={removeGlobalRule}
              onClear={() => setGlobalRules(createEmptyGlobalRules())}
            />

            <div className={`position-list ${rules.length <= 4 ? 'show-all' : ''}`}>
              {rules.map((rule, index) => (
                <PositionFilter
                  key={index}
                  index={index}
                  rule={rule}
                  onChange={(field, value) => updateRule(index, field, value)}
                  onClear={() => setRules((current) => current.map((item, itemIndex) => itemIndex === index ? createEmptyRule() : item))}
                />
              ))}
            </div>
          </aside>

          <section className="results-panel">
            <div className="results-heading">
              <div>
                <span className="section-kicker">MATCHING RESULTS</span>
                <h2><Filter size={20} /> 找到 <strong>{actualResults.length.toLocaleString()}</strong> 条</h2>
                <p>{filterCount ? `已启用 ${filterCount} 个筛选项` : `当前展示全部 ${length} 字成语`}{commonness !== 'all' && ` · ${COMMONNESS_LABELS[commonness]}`}</p>
              </div>
              <button className="secondary-button export" type="button" disabled={!actualResults.length} onClick={exportResults}>
                <Download size={16} /> 导出 CSV
              </button>
            </div>

            {actualResults.length ? (
              <>
                <div className="results-grid">
                  {displayed.map((entry) => (
                    <IdiomCard
                      key={entry.word}
                      entry={entry}
                      selected={selectedEntry?.word === entry.word}
                      onSelect={() => setSelectedWord(entry.word)}
                      onCopy={() => copyEntry(entry)}
                    />
                  ))}
                </div>
                {displayed.length < actualResults.length && (
                  <button className="load-more" type="button" onClick={() => setPage((current) => current + 1)}>
                    再看 {Math.min(PAGE_SIZE, actualResults.length - displayed.length)} 条
                    <span>已显示 {displayed.length} / {actualResults.length}</span>
                  </button>
                )}
              </>
            ) : <EmptyState onReset={reset} />}
          </section>
        </section>
      </main>

      <footer><span>成语高手 · 拼音筛选台</span><p>读音：pinyin-pro · 词条：cnchar-idiom · 常用度：jieba 语料词频</p></footer>
      {notice && <div className="toast"><Check size={16} /> {notice}</div>}
    </div>
  );
}
