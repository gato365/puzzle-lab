/* Puzzle Lab — shared core for the student and teacher apps.
   Loads after assets/js/data/{dict,words1000,bank}.js. Exposes window.PL. No backend: everything runs in the browser.
   Simulated classmates are generated from a seed derived from the two puzzle words, so the teacher app and every
   student phone that plays the same words see the same simulated class without talking to each other. */
window.PL = (function () {
  'use strict';

  /* ===================== helpers ===================== */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const VOW = 'AEIOU';
  const vowels = w => [...w].filter(c => VOW.includes(c)).length;
  const repeats = w => w.length - new Set(w).size;
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const SYM = { ok: '✓', near: '~', no: '✕' };

  /* ===================== constants + data ===================== */
  const TIME_LIMIT = 120, MAX_GUESSES = 6, MAX_HINTS = 4, SIM_PLAYERS = 28;
  const BANK = window.PL_BANK;
  const DEFAULT_PUZZLES = { A: bankEntry('A', 0), B: bankEntry('B', 0) };
  function bankEntry(k, i) { const e = BANK[k][i]; return { word: e.word, hints: e.hints.slice() }; }

  const DICT = new Set();
  { const s = window.PL_DICT_STR; for (let i = 0; i + 5 <= s.length; i += 5) DICT.add(s.substr(i, 5)); }
  const WORDS = window.PL_W1000.map(r => ({ word: r[0], no: r[1], fam: r[2], vowels: r[3], repeats: r[4], rare: r[5], n: r[6], diff: r[7], help: r[8], solve: r[9], guesses: r[10] }));

  /* ===================== game logic ===================== */
  function score(guess, answer) {
    const res = Array(answer.length).fill('no'); const left = {};
    for (let i = 0; i < answer.length; i++) { if (guess[i] === answer[i]) res[i] = 'ok'; else left[answer[i]] = (left[answer[i]] || 0) + 1; }
    for (let i = 0; i < answer.length; i++) { if (res[i] === 'ok') continue; const c = guess[i]; if (left[c] > 0) { res[i] = 'near'; left[c]--; } }
    return res;
  }
  function features(word) { return { wordLength: word.length, vowelCount: vowels(word), repeatCount: repeats(word) }; }

  /* Puzzle objects: {word, hints:[h1..h4]}. Normalize anything user-supplied. */
  function cleanPuzzle(p, fallback) {
    const word = String((p && p.word) || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    const hints = Array.from({ length: MAX_HINTS }, (_, i) => String((p && p.hints && p.hints[i]) || '').replace(/[\u0000-\u001f]/g, '').slice(0, 200));
    if (word.length !== 5) return fallback ? { word: fallback.word, hints: fallback.hints.slice() } : null;
    return { word, hints };
  }
  function cleanPuzzles(p) { return { A: cleanPuzzle(p && p.A, DEFAULT_PUZZLES.A), B: cleanPuzzle(p && p.B, DEFAULT_PUZZLES.B) }; }

  /* Compact URL encoding so the teacher's words travel to phones inside the QR code: ?p=WORD|h1|h2|h3|h4|WORD|h1|h2|h3|h4 */
  function encodePuzzles(p) { return ['A', 'B'].map(k => [p[k].word, ...p[k].hints].map(s => String(s).replace(/\|/g, '/')).join('|')).join('|'); }
  function decodePuzzles(str) {
    if (!str) return null; const parts = String(str).split('|'); if (parts.length !== 10) return null;
    const p = { A: { word: parts[0], hints: parts.slice(1, 5) }, B: { word: parts[5], hints: parts.slice(6, 10) } };
    const c = cleanPuzzles(p); if (!DICT.has(c.A.word) || !DICT.has(c.B.word)) return null; return c;
  }
  function studentUrl(base, code, puzzles, nSim, variant) {
    const q = []; if (code) q.push('code=' + encodeURIComponent(code));
    if (puzzles && encodePuzzles(puzzles) !== encodePuzzles(DEFAULT_PUZZLES)) q.push('p=' + encodeURIComponent(encodePuzzles(puzzles)));
    if (nSim && nSim !== SIM_PLAYERS) q.push('n=' + nSim);
    if (variant) q.push('v=' + variant);
    return base + (q.length ? (base.includes('?') ? '&' : '?') + q.join('&') : '');
  }

  /* Pick a fresh pair of words from the bank, skipping anything in `used` (array of words). Returns {A,B,exhausted}. */
  function freshPuzzles(used) {
    const u = new Set((used || []).map(w => String(w).toUpperCase())); const out = { exhausted: false };
    for (const k of ['A', 'B']) {
      const pool = BANK[k].filter(e => !u.has(e.word));
      let e; if (pool.length) e = pool[Math.floor(Math.random() * pool.length)]; else { out.exhausted = true; e = BANK[k][Math.floor(Math.random() * BANK[k].length)]; }
      out[k] = { word: e.word, hints: e.hints.slice() };
    }
    return out;
  }

  /* ===================== simulated classmates ===================== */
  function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let r = seed % 2147483647; if (r <= 0) r += 2147483646; return () => { r = (r * 48271) % 2147483647; return r / 2147483647; }; }
  const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  /**
   * simulateClass(puzzles, n, variant) → array of simulated players, each a finished attempt row plus a timeline:
   *   times[]   seconds (from play start) at which each guess was entered
   *   doneAt    seconds at which the game ended (120 if they ran out of time)
   *   submitAt  seconds at which they submitted their ratings (Infinity = never submitted)
   * Deterministic for a given word pair + variant, so teacher and students agree.
   */
  function simulateClass(puzzles, n, variant) {
    n = n || SIM_PLAYERS; const rnd = rng(hashStr(puzzles.A.word + '|' + puzzles.B.word + '|' + (variant || 0)) + 1);
    const out = [];
    for (let i = 0; i < n; i++) {
      const k = i % 2 ? 'B' : 'A'; const w = puzzles[k].word;
      const solved = rnd() < (k === 'A' ? 0.86 : 0.52);
      let g, timedOut = false;
      if (solved) g = k === 'A' ? pick(rnd, [2, 3, 3, 3, 4, 4, 5]) : pick(rnd, [3, 4, 4, 5, 5, 5, 6]);
      else if (rnd() < 0.6) g = 6; else { g = 3 + Math.floor(rnd() * 3); timedOut = true; }
      const pace = k === 'A' ? 9 + rnd() * 8 : 12 + rnd() * 9; const times = []; let t = 0;
      for (let j = 0; j < g; j++) { t += pace * (0.6 + rnd() * 0.9); times.push(Math.round(t)); }
      const cap = timedOut ? 100 + Math.floor(rnd() * 15) : 116;
      if (times[times.length - 1] > cap) { const f = cap / times[times.length - 1]; for (let j = 0; j < times.length; j++) times[j] = Math.max(j ? times[j - 1] + 1 : 1, Math.round(times[j] * f)); }
      const doneAt = timedOut ? TIME_LIMIT : times[times.length - 1];
      const hintsShown = Math.min(MAX_HINTS, solved ? g - 1 : g);
      const submitAt = rnd() < 0.93 ? doneAt + 8 + Math.round(rnd() * 32) : Infinity;
      const difficulty = clamp(Math.round((k === 'A' ? 2.1 : 3.7) + (solved ? -0.3 : 0.7) + (g - 3.5) * 0.15 + (rnd() - 0.5) * 2.2), 1, 5);
      const helpful = clamp(Math.round((k === 'A' ? 4.1 : 2.3) + (hintsShown === 0 ? (rnd() - 0.5) * 2 : 0) + (rnd() - 0.5) * 2.2), 1, 5);
      out.push(Object.assign({ participantId: 'sim-' + (i + 1), simulated: true, puzzle: k, word: w, guesses: g, solved, elapsed: doneAt, hintsShown, difficulty, helpful, submittedAt: '', times, doneAt, submitAt }, features(w)));
    }
    return out;
  }
  /* State of each simulated player t seconds after play started (Infinity = everyone finished). */
  function progressAt(players, t) {
    return players.map(p => { const g = p.times.filter(x => x <= t).length; const done = t >= p.doneAt; return { participantId: p.participantId, simulated: true, puzzle: p.puzzle, guesses: g, solved: done && p.solved, done, elapsed: Math.min(t, p.doneAt), hintsShown: Math.min(MAX_HINTS, g) }; });
  }
  /* Finished + submitted rows as of t seconds (Infinity = everyone who ever submits). */
  function attemptsAt(players, t) { return players.filter(p => p.submitAt <= t); }

  /* ===================== summaries + charts ===================== */
  function summarize(attempts) {
    const g = { A: [], B: [] }; attempts.forEach(a => { if (g[a.puzzle]) g[a.puzzle].push(a); });
    const out = {};
    for (const k of ['A', 'B']) { const a = g[k]; out[k] = { n: a.length, solveRate: a.length ? a.filter(x => x.solved).length / a.length : null, avgDiff: mean(a.map(x => x.difficulty)), avgHelp: mean(a.map(x => x.helpful)), avgGuesses: mean(a.map(x => x.guesses)), avgTime: mean(a.map(x => x.elapsed)), avgHints: mean(a.map(x => x.hintsShown)), rows: a }; }
    return out;
  }
  function dotPlot(attempts, pid, opts = {}) {
    const sum = summarize(attempts); const W = opts.w || 520, H = opts.h || 300, L = 44, R = 16, T = 18, B = 44;
    const y = v => T + (5 - v) / 4 * (H - T - B); const xs = { A: L + (W - L - R) * 0.27, B: L + (W - L - R) * 0.73 };
    let dots = '';
    for (const k of ['A', 'B']) {
      const byVal = {}; sum[k].rows.forEach(a => { (byVal[a.difficulty] = byVal[a.difficulty] || []).push(a); });
      Object.entries(byVal).forEach(([v, arr]) => arr.forEach((a, i) => { const off = (i - (arr.length - 1) / 2) * 13; dots += `<circle class="dot ${a.participantId === pid ? 'sel' : ''}" cx="${xs[k] + off}" cy="${y(+v)}" r="6"><title>Puzzle ${k}: rated ${v}, ${a.solved ? 'solved' : 'not solved'} in ${a.guesses} guesses, ${a.hintsShown} hint${a.hintsShown === 1 ? '' : 's'} shown</title></circle>`; }));
      if (sum[k].avgDiff != null) dots += `<line class="mean" x1="${xs[k] - 50}" x2="${xs[k] + 50}" y1="${y(sum[k].avgDiff)}" y2="${y(sum[k].avgDiff)}"/><text x="${xs[k] + 54}" y="${y(sum[k].avgDiff) + 4}" class="lab">avg ${sum[k].avgDiff.toFixed(1)}</text>`;
    }
    const grid = [1, 2, 3, 4, 5].map(v => `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dot plot of difficulty ratings by puzzle">${grid}<line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>
    <text x="${xs.A}" y="${H - B + 20}" text-anchor="middle" class="lab">Puzzle A (n=${sum.A.n})</text><text x="${xs.B}" y="${H - B + 20}" text-anchor="middle" class="lab">Puzzle B (n=${sum.B.n})</text>
    <text x="12" y="${T + (H - T - B) / 2}" transform="rotate(-90 12 ${T + (H - T - B) / 2})" text-anchor="middle">Rated difficulty (1 easy → 5 hard)</text>${dots}</svg>`;
  }
  function ols(pts) { const n = pts.length; if (n < 2) return null; const mx = mean(pts.map(p => p[0])), my = mean(pts.map(p => p[1])); let sxy = 0, sxx = 0; pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) * (x - mx); }); if (!sxx) return null; const b = sxy / sxx; return { b, a: my - b * mx }; }
  const AXES = { fam: { label: 'How familiar the word is (1 rare → 5 common; real word-frequency data)', min: 1, max: 5, chip: 'Familiarity' }, help: { label: 'Average hint helpfulness (1 → 5; simulated)', min: 1, max: 5, chip: 'Hint helpfulness' }, vowels: { label: 'Vowel count (A E I O U; real)', min: 0, max: 5, chip: 'Vowels' }, repeats: { label: 'Repeated-letter count (real)', min: 0, max: 3, chip: 'Repeated letters' }, rare: { label: 'Rare letters in the word (J Q X Z V K W; real)', min: 0, max: 3, chip: 'Rare letters' } };
  function hashJ(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997; return h / 997 - 0.5; }
  function scatter(xKey, trend, sel, marks, opts = {}) {
    const W = opts.w || 520, H = opts.h || 340, L = 44, R = 16, T = 18, B = 48; const ax = AXES[xKey];
    const x = v => L + (v - ax.min) / (ax.max - ax.min) * (W - L - R); const y = v => T + (5 - v) / 4 * (H - T - B);
    const fit = ols(WORDS.map(s => [s[xKey], s.diff])); const isCat = !['fam', 'help'].includes(xKey);
    const jit = s => isCat ? hashJ(s.word) * (W - L - R) / (ax.max - ax.min) * 0.55 : 0;
    const jy = s => isCat ? hashJ(s.word + 'y') * 8 : 0;
    let dots = WORDS.map(s => `<circle class="dot many" data-w="${s.word}" cx="${(x(s[xKey]) + jit(s)).toFixed(1)}" cy="${(y(s.diff) + jy(s)).toFixed(1)}" r="4"><title>${s.word}</title></circle>`).join('');
    (marks || []).forEach(m => { const s = WORDS.find(w => w.word === m); if (s) dots += `<circle class="dot mark" data-w="${s.word}" cx="${(x(s[xKey]) + jit(s)).toFixed(1)}" cy="${(y(s.diff) + jy(s)).toFixed(1)}" r="7"><title>${s.word}</title></circle><text x="${(x(s[xKey]) + jit(s) + 9).toFixed(1)}" y="${(y(s.diff) + jy(s) - 6).toFixed(1)}" class="lab">${s.word}</text>`; });
    if (sel) { const s = WORDS.find(w => w.word === sel); if (s) dots += `<circle class="dot sel" data-w="${s.word}" cx="${(x(s[xKey]) + jit(s)).toFixed(1)}" cy="${(y(s.diff) + jy(s)).toFixed(1)}" r="8"><title>${s.word}</title></circle>`; }
    const xt = isCat ? Array.from({ length: ax.max - ax.min + 1 }, (_, i) => ax.min + i) : [1, 2, 3, 4, 5];
    const grid = [1, 2, 3, 4, 5].map(v => `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('') + xt.map(v => `<text x="${x(v)}" y="${H - B + 18}" text-anchor="middle">${v}</text>`).join('');
    const cl = v => clamp(v, 1, 5);
    const line = trend && fit ? `<line class="trend" x1="${x(ax.min)}" y1="${y(cl(fit.a + fit.b * ax.min))}" x2="${x(ax.max)}" y2="${y(cl(fit.a + fit.b * ax.max))}"/>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatterplot of 1,000 Wordle answer words" id="scat">${grid}<line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/><line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
   <text x="${L + (W - L - R) / 2}" y="${H - 10}" text-anchor="middle" class="lab">${ax.label}</text><text x="12" y="${T + (H - T - B) / 2}" transform="rotate(-90 12 ${T + (H - T - B) / 2})" text-anchor="middle">Average rated difficulty (1 → 5; simulated)</text>${dots}${line}</svg>`;
  }
  const EXPLAIN = {
    fam: 'More familiar words tend to get lower difficulty ratings. The pattern is strong but not perfect: find a common word that still rated hard.',
    help: 'Puzzles with more helpful hints tend to rate easier, with plenty of exceptions. Remember this axis is simulated: these 1,000 words have no real hints.',
    vowels: 'Vowel count on its own shows almost no pattern. Not every feature matters.',
    repeats: 'Repeated letters lean a little harder, but the dots overlap a lot. A weak, unclear relationship.',
    rare: 'Words with J, Q, X, Z, V, K or W lean harder, but most words have none, so the comparison rests on a small group.'
  };

  /* ===================== lesson blocks (shared by both apps) ===================== */
  function exampleRow(word, ans) { const r = score(word, ans); return `<div class="grid" style="grid-template-rows:none;width:min(100%,250px);margin:0"><div class="r">${[...word].map((c, i) => `<div class="tile sm ${r[i]}">${c}<span class="sym">${SYM[r[i]]}</span></div>`).join('')}</div></div>`; }
  function puzzleCard(k, p) {
    return `<div class="card stack"><div class="eyebrow">Puzzle ${k}</div><div class="w">${esc(p.word)}</div><ol>${p.hints.map(h => `<li>${esc(h)}</li>`).join('')}</ol><p class="tiny">${vowels(p.word)} vowels · ${repeats(p.word)} repeated letter${repeats(p.word) === 1 ? '' : 's'}</p></div>`;
  }
  /* res = {puzzles, attempts}; pid = the viewer's own participant id (student) or null (teacher). */
  function classBlock(res, pid, present) {
    const att = res.attempts; const sum = summarize(att); const live = att.filter(a => !a.simulated).length; const p = res.puzzles;
    const stats = k => `<div class="stat"><div><b class="num">${sum[k].n}</b><span>students</span></div><div><b class="num">${sum[k].solveRate == null ? '—' : Math.round(sum[k].solveRate * 100) + '%'}</b><span>solved it</span></div><div><b class="num">${sum[k].avgDiff == null ? '—' : sum[k].avgDiff.toFixed(1)}</b><span>avg difficulty</span></div><div><b class="num">${sum[k].avgHelp == null ? '—' : sum[k].avgHelp.toFixed(1)}</b><span>avg hint help</span></div><div><b class="num">${sum[k].avgGuesses == null ? '—' : sum[k].avgGuesses.toFixed(1)}</b><span>avg guesses</span></div><div><b class="num">${sum[k].avgHints == null ? '—' : sum[k].avgHints.toFixed(1)}</b><span>avg hints seen</span></div></div>`;
    return `<div class="wordinfo">${puzzleCard('A', p.A)}${puzzleCard('B', p.B)}</div>
    <div class="card stack">
      <div class="row spread"><h3>How hard did each group find it?</h3>${live ? `<span class="pill warn">${live} real + ${att.length - live} simulated</span>` : '<span class="pill warn">simulated class</span>'}</div>
      ${att.length ? dotPlot(att, pid, { w: present ? 760 : 520, h: present ? 360 : 300 }) : '<p class="muted">No responses yet.</p>'}
      <p class="small muted">Each dot is one player. Higher dots mean the student rated the puzzle as harder. The green line is each group's average.${!present && att.some(a => a.participantId === pid) ? ' Your dot is green.' : ''}</p>
      <div class="cols"><div><div class="eyebrow">Puzzle A</div>${stats('A')}</div><div><div class="eyebrow">Puzzle B</div>${stats('B')}</div></div>
      <p class="tiny">"Solved" means the word was found within 6 guesses and 2 minutes. Running out of time, giving up, or using all six guesses counts as not solved, never as a six-guess win. Hints appeared one at a time after each wrong guess, up to ${MAX_HINTS}.</p>
    </div>
    <div class="card stack"><h3>Talk about it</h3><div class="ask"><div>Did one group tend to rate its puzzle as harder?</div><div>Did everyone with the same puzzle have the same experience?</div><div>Could the word, the repeated letters, or the hints explain the difference?</div></div>
      <div class="notice">We changed <b>two things at once</b>: the word and the hint quality. So these results can't tell us which one caused the difference. <b>What would we keep the same if we wanted to test just the hints?</b></div></div>`;
  }
  function simExplainer() {
    return `<div class="card stack"><h3>What "simulated data" means</h3>
    <p class="small">Your own dot came from a <b>real person</b>: you. Your simulated classmates, and the 1,000-word plot, are different. The <b>words</b> are real (they are Wordle's own answers) and so are their features: how common each word is in English, how many vowels, repeated letters, and rare letters it has. But nobody has rated 1,000 puzzles. So the <b>difficulty ratings are simulated</b>: a computer followed a recipe we wrote, something like "start at 4.9, subtract a bit for familiar words, add a bit for repeated or rare letters, then add some randomness for each pretend player."</p>
    <p class="small"><b>Why use it at all?</b> It lets you practice reading a big scatterplot before the real data exists, and it shows what "many words, many players" would look like.</p>
    <p class="small"><b>The catch.</b> A simulated dataset can only show you what the recipe put in. It is not evidence about real players. If you wanted to know what really makes a Wordle hard, you would have to collect ratings from real people.</p></div>`;
  }
  function simBlock(st, present, marks) {
    const s = st.sel ? WORDS.find(x => x.word === st.sel) : null; const xKey = st.xAxis;
    return `<div class="card stack">
      <div class="row spread"><h3>Zoom out: 1,000 Wordle answers</h3><span class="pill warn">ratings simulated</span></div>
      <p class="small muted">Each dot is one word from Wordle's official answer list (its first 1,000, in order). Its position left-to-right uses real information about the word. Its height is a <b>simulated</b> difficulty rating averaged over 18–40 pretend players. Tap a dot, or type a word.</p>
      <div class="chips">${Object.entries(AXES).map(([k, a]) => `<button class="chip" data-x="${k}" aria-pressed="${xKey === k}">${a.chip}</button>`).join('')}<button class="chip" id="trend" aria-pressed="${st.trend}">Trend line</button></div>
      ${scatter(xKey, st.trend, st.sel, marks, { w: present ? 760 : 520, h: present ? 400 : 340 })}
      <div class="row"><input id="findw" maxlength="5" placeholder="Find a word, e.g. APPLE" autocapitalize="characters" style="max-width:220px;min-height:40px" value="${esc(st.find || '')}"><span class="tiny" id="findmsg"></span></div>
      ${s ? `<div class="hint"><b>${esc(s.word)}</b><span class="small">Wordle answer #${s.no} · familiarity ${s.fam.toFixed(1)} · ${s.vowels} vowels · ${s.repeats} repeated · ${s.rare} rare letter${s.rare === 1 ? '' : 's'} · <i>simulated:</i> ${s.n} players rated it <b>${s.diff.toFixed(1)}</b>, solved ${Math.round(s.solve * 100)}%, avg ${s.guesses.toFixed(1)} guesses</span></div>` : ''}
      <p class="small muted">${EXPLAIN[xKey]} ${st.trend ? 'The line summarizes a pattern. It doesn\'t mean every word follows it, and it doesn\'t prove the feature <i>caused</i> the difference.' : ''}</p>
    </div>${simExplainer()}`;
  }
  /* Wire up the 1,000-word block. root = element containing it, st = state object with xAxis/trend/sel/find, re = rerender fn. */
  function bindSim(root, st, re) {
    root.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { st.xAxis = b.dataset.x; re(); }));
    root.querySelector('#trend')?.addEventListener('click', () => { st.trend = !st.trend; re(); });
    const sv = root.querySelector('#scat'); if (sv) sv.addEventListener('click', e => { const c = e.target.closest('[data-w]'); if (!c) return; st.sel = st.sel === c.dataset.w ? null : c.dataset.w; st.find = st.sel || ''; re(); });
    const f = root.querySelector('#findw'); if (f) f.addEventListener('input', e => { const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); st.find = v; const m = root.querySelector('#findmsg'); if (v.length === 5) { if (WORDS.some(w => w.word === v)) { st.sel = v; re(); root.querySelector('#findw')?.focus(); } else if (m) m.textContent = 'Not in these 1,000 answers.'; } else if (m) m.textContent = ''; });
  }
  function whyBlock() {
    return `<div class="card stack"><h3>Why this is data science</h3>
    <div class="ask"><div><b>Outcome</b>: the thing we want to understand. Difficulty, guesses, solved or not, time.</div><div><b>Feature</b>: something that might explain the outcome. Repeated letters, vowels, how familiar the word is, how many hints you needed and how helpful they were.</div><div><b>Variation</b>: people don't all have the same experience. Even students with the same puzzle landed on different dots.</div></div>
    <p class="small muted">Other features we didn't collect could matter too: age, language background, whether you've played Wordle before, whether you know the word's context. A puzzle score reflects the <b>person, the puzzle, and the conditions</b>, not just someone's ability.</p>
    <div class="notice info"><b>If we wanted to predict how difficult a new word puzzle would be, what data would you want to collect?</b></div></div>`;
  }
  function wrapBlock(res) {
    const sum = res ? summarize(res.attempts) : null; const p = res ? res.puzzles : DEFAULT_PUZZLES;
    const f = (v, d = 1) => v == null ? '—' : v.toFixed(d); const pct = v => v == null ? '—' : Math.round(v * 100) + '%';
    const harder = sum && sum.A.avgDiff != null && sum.B.avgDiff != null ? (sum.B.avgDiff > sum.A.avgDiff ? 'B' : sum.A.avgDiff > sum.B.avgDiff ? 'A' : null) : null;
    return `<div class="card stack present"><h2>What just happened</h2>
    <ol class="wrap" style="margin:0;padding-left:26px">
      <li><b>You ran an experiment on yourselves.</b> Half the room got <b>${esc(p.A.word)}</b> with specific hints, half got <b>${esc(p.B.word)}</b> with vague hints. Your birthday decided which; that's a convenient rule, not true random assignment.</li>
      <li><b>You produced data.</b> ${sum ? `${sum.A.n + sum.B.n} rows: guesses, time, hints seen, solved or not, and two ratings each.` : 'Guesses, time, hints seen, solved or not, and two ratings each.'}</li>
      <li><b>The groups differed.</b> ${sum && harder ? `Puzzle ${harder} was rated harder on average (${f(harder === 'B' ? sum.B.avgDiff : sum.A.avgDiff)} vs ${f(harder === 'B' ? sum.A.avgDiff : sum.B.avgDiff)}); solve rates were ${pct(sum.A.solveRate)} for A and ${pct(sum.B.solveRate)} for B.` : sum && sum.A.n && sum.B.n ? `Both groups rated their puzzle about the same (${f(sum.A.avgDiff)} vs ${f(sum.B.avgDiff)}). Our hypothesis didn't show up this time, and that is a result too.` : 'Compare the averages and solve rates on the class results stage.'}</li>
      <li><b>But the groups also varied inside.</b> Same word, same hints, different dots. A score reflects the person, the puzzle, and the conditions.</li>
      <li><b>We can't say what caused it.</b> Word and hints changed together. To isolate hints, keep the word the same and change only the hints.</li>
      <li><b>Zooming out needed simulated data.</b> Real words and real features, pretend ratings. Useful for practice, not evidence.</li>
    </ol>
    <h3>Three words to keep</h3>
    <div class="ask"><div><b>Outcome</b> — what we want to predict (difficulty).</div><div><b>Feature</b> — what might explain it (hints, familiarity, repeated letters).</div><div><b>Variation</b> — why one number never tells the whole story.</div></div>
    <div class="notice info"><b>Exit question:</b> to predict how hard a brand-new word will be, what would you collect, from whom, and what would you keep the same?</div></div>`;
  }

  /* Closing stages: careers, then Cal Poly. Text lives in assets/js/data/outreach.js. */
  function outreachList(section) {
    const o = window.PL_OUTREACH[section];
    return `<div class="card stack present"><h2>${esc(o.heading)}</h2><p class="muted">${esc(o.intro)}</p>
    <div class="cols tight">${o.items.map(i => `<div class="hint"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>`).join('')}</div></div>`;
  }
  function careersBlock() {
    const o = window.PL_OUTREACH.careers;
    return `${outreachList('careers')}<div class="card stack present"><h3>${esc(o.perks.heading)}</h3><ul class="wrap" style="margin:0;padding-left:22px">${o.perks.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul><div class="notice info"><b>${esc(o.ask)}</b></div></div>`;
  }
  function calpolyBlock() {
    const o = window.PL_OUTREACH.calpoly;
    return `${outreachList('calpoly')}<div class="card stack present"><h3>${esc(o.benefits.heading)}</h3><ul class="wrap" style="margin:0;padding-left:22px">${o.benefits.items.map(t => `<li>${esc(t)}</li>`).join('')}</ul><div class="notice info"><b>${esc(o.ask)}</b></div></div>`;
  }

  /* CSV of attempt rows (same columns the old Google Sheet had). */
  function toCSV(code, attempts) {
    const cols = ['code', 'participant_id', 'puzzle', 'word', 'guesses', 'solved', 'elapsed_seconds', 'hints_shown', 'rated_difficulty', 'rated_hint_helpfulness', 'word_length', 'vowel_count', 'repeated_letter_count', 'simulated'];
    const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [cols.join(',')].concat(attempts.map(a => [code, a.participantId, a.puzzle, a.word, a.guesses, a.solved ? 'TRUE' : 'FALSE', a.elapsed, a.hintsShown, a.difficulty, a.helpful, a.wordLength, a.vowelCount, a.repeatCount, a.simulated ? 'TRUE' : 'FALSE'].map(q).join(','))).join('\n');
  }

  /* localStorage that never throws (private windows, blocked storage). */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  const cleanCode = s => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  return { esc, vowels, repeats, mmss, mean, clamp, SYM, TIME_LIMIT, MAX_GUESSES, MAX_HINTS, SIM_PLAYERS, BANK, DEFAULT_PUZZLES, DICT, WORDS, score, features,
    cleanPuzzle, cleanPuzzles, encodePuzzles, decodePuzzles, studentUrl, freshPuzzles, simulateClass, progressAt, attemptsAt, summarize, dotPlot, scatter, AXES,
    exampleRow, puzzleCard, classBlock, simExplainer, simBlock, bindSim, whyBlock, wrapBlock, careersBlock, calpolyBlock, toCSV, store, cleanCode };
})();
