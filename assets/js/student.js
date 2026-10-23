/* Puzzle Lab — student app. Runs entirely in the phone's browser.
   Round 1 uses the teacher's words (carried in the QR-code URL as ?p=…) or the defaults. "Play again" draws a word
   never used before in this browser. Classmates are simulated from the same seed the teacher app uses. */
(function () {
  'use strict';
  const { esc, mmss, clamp, SYM, TIME_LIMIT, MAX_GUESSES, MAX_HINTS, SIM_PLAYERS, DEFAULT_PUZZLES, DICT, score, features, decodePuzzles, freshPuzzles, simulateClass, attemptsAt,
    exampleRow, classBlock, simBlock, bindSim, whyBlock, store, cleanCode } = window.PL;
  const $app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const CONFIG = decodePuzzles(qs.get('p')) || DEFAULT_PUZZLES;   // the teacher's words, if the QR carried them
  const N_SIM = clamp(parseInt(qs.get('n'), 10) || SIM_PLAYERS, 6, 60), VARIANT = parseInt(qs.get('v'), 10) || 0;   // same simulated class as the teacher's screen
  const USED_KEY = 'pl_used_words';

  const S = { step: 'enter', code: cleanCode(qs.get('code') || ''), day: '', group: null, pid: null, round: 0, puzzles: null, puzzle: null, sims: [],
    guesses: [], cur: '', over: false, solved: false, startAt: 0, elapsed: 0, timer: null, left: TIME_LIMIT, hintsShown: 0, justHint: false,
    confirmQuit: false, difficulty: null, helpful: null, results: null, error: null, resultsTab: 'class', xAxis: 'fam', trend: true, sel: null, find: '', endMsg: '', history: [], exhausted: false };

  const newPid = () => 'p-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
  const usedWords = () => store.get(USED_KEY, []);
  function markUsed(p) { const u = new Set(usedWords()); u.add(p.A.word); u.add(p.B.word); store.set(USED_KEY, [...u]); }

  /* ---------- render ---------- */
  function render() {
    let body = '';
    switch (S.step) { case 'enter': body = viewEnter(); break; case 'example': body = viewExample(); break; case 'play': body = viewPlay(); break; case 'rate': body = viewRate(); break; case 'results': body = viewResults(); break; }
    $app.innerHTML = `<div class="stack fade"><div class="brand"><b>Puzzle Lab</b><div class="row">${S.round > 1 ? `<span class="pill">Round ${S.round}</span>` : ''}${S.puzzle ? `<span class="pill">Puzzle ${S.puzzle.key}</span>` : ''}</div></div>${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}${body}</div>`;
    bind();
  }
  function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }
  function viewEnter() {
    return `<div class="stack" style="gap:18px;padding-top:8px">
    <h1>What makes a word puzzle hard?</h1>
    <p class="muted">One five-letter word, six guesses, two minutes. Hints appear only after wrong guesses. Then the class's data tells us what made it hard.</p>
    <div class="card stack">
      <label class="f">Class code (from your teacher)<input id="code" autocapitalize="characters" autocomplete="off" maxlength="6" placeholder="e.g. P3" value="${esc(S.code)}"></label>
      <label class="f">The day of the month you were born (1–31). Just the day.<input id="day" inputmode="numeric" maxlength="2" placeholder="e.g. 14" value="${esc(S.day)}"></label>
      <p class="tiny">The day picks which puzzle you get. We don't ask your name, birthday, or anything else. Nothing leaves this phone.</p>
      <button class="btn primary block" id="go">Get my puzzle</button>
    </div></div>`;
  }
  function viewExample() {
    const again = S.round > 1;
    return `<h2>${again ? `Round ${S.round}: a new word` : 'How to play'}</h2>
  ${again ? `<div class="notice info">Same group (Puzzle ${S.puzzle.key}), brand-new word you have not seen before${S.exhausted ? ' (you have used every word in the bank, so words may now repeat)' : ''}. Your simulated classmates get new words too.</div>` : ''}
  <div class="card stack">
    <p class="small">If the secret word were <b>CRANE</b> and you guessed <b>TRACK</b>:</p>
    ${exampleRow('TRACK', 'CRANE')}
    <div class="legend"><span><i style="background:var(--ok)"></i>✓ right letter, right spot</span><span><i style="background:var(--near)"></i>~ in the word, other spot</span><span><i style="background:var(--no)"></i>✕ not in the word</span></div>
    <p class="tiny">R and A are placed; C is in the word but elsewhere; T and K are out. A letter can't be marked more times than it appears in the answer.</p>
  </div>
  <div class="card stack"><h3>Rules</h3>
    <ul class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px"><li>Up to <b>6 guesses</b>. Guesses must be real five-letter words.</li><li><b>2 minutes</b>. The clock starts when you tap Play.</li><li><b>No hint at the start.</b> Each wrong guess reveals one hint, up to <b>${MAX_HINTS}</b>.</li></ul></div>
  <button class="btn primary block" id="play" style="min-height:56px;font-size:18px">Play</button>`;
  }
  function hintsBlock() {
    const p = S.puzzle; const shown = p.hints.slice(0, S.hintsShown);
    let html = shown.map((h, i) => `<div class="hint ${S.justHint && i === shown.length - 1 ? 'new' : ''}"><b>Hint ${i + 1}</b><span>${esc(h)}</span></div>`).join('');
    if (!S.over) {
      if (S.hintsShown === 0) html += `<div class="hint locked"><b>Hints</b><span>None yet. One appears after each wrong guess, up to ${MAX_HINTS}.</span></div>`;
      else if (S.hintsShown < MAX_HINTS) html += `<div class="hint locked"><b>Hint ${S.hintsShown + 1}</b><span>Appears after your next wrong guess.</span></div>`;
      else html += `<div class="hint locked"><b>&nbsp;</b><span>All ${MAX_HINTS} hints shown.</span></div>`;
    }
    return `<div class="hints" aria-live="polite">${html}</div>`;
  }
  function viewPlay() {
    const rows = [];
    for (let i = 0; i < MAX_GUESSES; i++) {
      if (i < S.guesses.length) { const g = S.guesses[i]; rows.push(`<div class="r">${[...g.w].map((c, k) => `<div class="tile ${g.r[k]}">${c}<span class="sym">${SYM[g.r[k]]}</span></div>`).join('')}</div>`); }
      else if (i === S.guesses.length && !S.over) { const cs = S.cur.padEnd(5, ' '); rows.push(`<div class="r">${[...cs].map(c => `<div class="tile ${c !== ' ' ? 'filled' : ''}">${c.trim()}</div>`).join('')}</div>`); }
      else rows.push(`<div class="r">${'<div class="tile"></div>'.repeat(5)}</div>`);
    }
    const ks = {}; S.guesses.forEach(g => [...g.w].forEach((c, i) => { const v = g.r[i]; const rank = { ok: 3, near: 2, no: 1 }; if (!ks[c] || rank[v] > rank[ks[c]]) ks[c] = v; }));
    const kb = ['QWERTYUIOP', 'ASDFGHJKL', '⏎ZXCVBNM⌫'].map(r => `<div class="kr">${[...r].map(c => c === '⏎' ? `<button class="key wide" data-k="ENTER">ENTER</button>` : c === '⌫' ? `<button class="key wide" data-k="BACK" aria-label="Backspace">⌫</button>` : `<button class="key ${ks[c] || ''}" data-k="${c}">${c}</button>`).join('')}</div>`).join('');
    const quit = S.over ? '' : S.confirmQuit ? `<div class="notice stack"><b>Give up?</b><span class="small">This ends your game and shows the word. It counts as "not solved."</span><div class="row"><button class="btn sm" id="quitYes">Yes, show me the word</button><button class="btn sm primary" id="quitNo">Keep playing</button></div></div>` : `<button class="btn ghost block sm" id="giveup">Give up (ends the game, reveals the word)</button>`;
    return `<div class="row spread"><h3 style="margin:0">Guess the word</h3><div class="timer num ${S.left <= 20 ? 'low' : ''}" id="timer" aria-live="polite">${mmss(S.left)}</div></div>
  ${hintsBlock()}
  <div class="grid" id="grid" aria-label="guesses">${rows.join('')}</div>
  <div class="small" style="min-height:22px;text-align:center;font-weight:600" id="msg" aria-live="assertive">${S.over ? esc(S.endMsg || '') : ''}</div>
  ${S.over ? `<button class="btn primary block" id="toRate">${S.solved ? 'Solved! Rate it' : 'Rate it'}</button>` : `<div class="kb" id="kb">${kb}</div>${quit}`}`;
  }
  function viewRate() {
    return `<h2>Two quick ratings</h2>
  <div class="card stack"><h3>How difficult did this puzzle feel?</h3>
    <div class="scale">${[1, 2, 3, 4, 5].map(n => `<button data-diff="${n}" aria-pressed="${S.difficulty === n}">${n}</button>`).join('')}</div><div class="scale-ends"><span>1 = very easy</span><span>5 = very hard</span></div></div>
  <div class="card stack"><h3>How helpful were the hints?</h3>
    ${S.hintsShown === 0 ? '<p class="small muted">You solved it before any hint appeared. Rate how helpful you think the hints would have been (or 1 = you didn\'t need them).</p>' : `<p class="small muted">You saw ${S.hintsShown} of ${MAX_HINTS} hints.</p>`}
    <div class="scale">${[1, 2, 3, 4, 5].map(n => `<button data-help="${n}" aria-pressed="${S.helpful === n}">${n}</button>`).join('')}</div><div class="scale-ends"><span>1 = not at all</span><span>5 = very helpful</span></div></div>
  <div class="stat"><div><b>${S.solved ? 'Solved' : 'Not solved'}</b><span>in ${S.guesses.length} guess${S.guesses.length === 1 ? '' : 'es'}</span></div><div><b class="num">${mmss(S.elapsed)}</b><span>time used</span></div><div><b class="num">${S.hintsShown}</b><span>hints shown</span></div></div>
  <button class="btn primary block" id="submit" ${S.difficulty && S.helpful ? '' : 'disabled'} style="min-height:56px;font-size:18px">Submit & see the class</button>`;
  }
  function historyBlock() {
    if (S.history.length < 2) return '';
    return `<div class="card stack"><h3>Your rounds</h3><ol class="history small" style="margin:0;padding-left:20px">${S.history.map(h => `<li><b>${esc(h.word)}</b> (Puzzle ${h.puzzle}): ${h.solved ? 'solved in ' + h.guesses : 'not solved'}, ${h.hintsShown} hint${h.hintsShown === 1 ? '' : 's'}, rated ${h.difficulty}/5</li>`).join('')}</ol><p class="tiny">The class chart above shows the current round only, because each round uses different words.</p></div>`;
  }
  function viewResults() {
    const tabs = [['class', 'Our class'], ['sim', '1,000 words'], ['why', 'Why it matters']];
    const res = { puzzles: S.puzzles, attempts: attemptsAt(S.sims, Infinity).concat([S.results]) };
    return `<h2>${S.resultsTab === 'class' ? 'What the class found' : S.resultsTab === 'sim' ? 'A bigger dataset' : 'Why this matters'}</h2>
  <div class="tabs">${tabs.map(([k, l]) => `<button class="tab" data-tab="${k}" aria-pressed="${S.resultsTab === k}">${l}</button>`).join('')}</div>
  ${S.resultsTab === 'class' ? classBlock(res, S.pid, false) + historyBlock() : S.resultsTab === 'sim' ? simBlock(S, false, [S.puzzles.A.word, S.puzzles.B.word]) : whyBlock()}
  ${S.resultsTab !== 'why' ? `<button class="btn block" id="nextTab">${S.resultsTab === 'class' ? 'Zoom out to 1,000 words' : 'Why this matters'}</button>` : ''}
  <button class="btn ghost block" id="again">Play again with a new word</button>`;
  }

  /* ---------- events ---------- */
  function bind() {
    const q = s => $app.querySelector(s);
    q('#go')?.addEventListener('click', start);
    q('#code')?.addEventListener('input', e => S.code = e.target.value.toUpperCase());
    q('#day')?.addEventListener('input', e => S.day = e.target.value.replace(/[^\d]/g, ''));
    q('#day')?.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
    q('#play')?.addEventListener('click', () => { S.step = 'play'; S.startAt = Date.now(); S.left = TIME_LIMIT; S.timer = setInterval(tick, 250); render(); window.scrollTo(0, 0); });
    if (S.step === 'play') {
      $app.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => key(b.dataset.k)));
      q('#giveup')?.addEventListener('click', () => { S.confirmQuit = true; rerender(); });
      q('#quitNo')?.addEventListener('click', () => { S.confirmQuit = false; rerender(); });
      q('#quitYes')?.addEventListener('click', () => finish(false, 'You gave up.'));
      q('#toRate')?.addEventListener('click', () => { S.step = 'rate'; render(); window.scrollTo(0, 0); });
    }
    if (S.step === 'rate') {
      $app.querySelectorAll('[data-diff]').forEach(b => b.addEventListener('click', () => { S.difficulty = +b.dataset.diff; rerender(); }));
      $app.querySelectorAll('[data-help]').forEach(b => b.addEventListener('click', () => { S.helpful = +b.dataset.help; rerender(); }));
      q('#submit')?.addEventListener('click', submit);
    }
    if (S.step === 'results') {
      $app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { S.resultsTab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
      q('#nextTab')?.addEventListener('click', () => { S.resultsTab = S.resultsTab === 'class' ? 'sim' : 'why'; render(); window.scrollTo(0, 0); });
      q('#again')?.addEventListener('click', playAgain);
      bindSim($app, S, rerender);
    }
  }
  document.addEventListener('keydown', e => { if (S.step !== 'play' || S.over || S.confirmQuit) return; if (e.metaKey || e.ctrlKey || e.altKey) return; const k = e.key; if (k === 'Enter') key('ENTER'); else if (k === 'Backspace') key('BACK'); else if (/^[a-zA-Z]$/.test(k)) key(k.toUpperCase()); });

  /* ---------- rounds ---------- */
  function newRound(puzzles) {
    S.round++; S.puzzles = puzzles; S.puzzle = Object.assign({ key: S.group }, puzzles[S.group]); S.pid = newPid();
    S.sims = simulateClass(puzzles, N_SIM, VARIANT); markUsed(puzzles);
    Object.assign(S, { guesses: [], cur: '', over: false, solved: false, startAt: 0, elapsed: 0, timer: null, left: TIME_LIMIT, hintsShown: 0, justHint: false, confirmQuit: false, difficulty: null, helpful: null, results: null, error: null, resultsTab: 'class', sel: null, find: '', endMsg: '' });
    S.step = 'example';
  }
  function start() {
    const day = parseInt(S.day, 10);
    if (!(day >= 1 && day <= 31)) { S.error = 'Enter the day of the month you were born, 1 to 31.'; rerender(); return; }
    S.code = cleanCode(S.code);
    if (!S.code) { S.error = 'Enter the class code.'; rerender(); return; }
    S.group = day % 2 === 0 ? 'A' : 'B'; S.error = null;
    newRound({ A: { word: CONFIG.A.word, hints: CONFIG.A.hints.slice() }, B: { word: CONFIG.B.word, hints: CONFIG.B.hints.slice() } });
    render(); window.scrollTo(0, 0);
  }
  function playAgain() {
    const fresh = freshPuzzles(usedWords().concat([S.puzzles.A.word, S.puzzles.B.word]));
    S.exhausted = fresh.exhausted; newRound({ A: fresh.A, B: fresh.B }); render(); window.scrollTo(0, 0);
  }

  /* ---------- play ---------- */
  function tick() {
    const el = Math.floor((Date.now() - S.startAt) / 1000); S.left = Math.max(0, TIME_LIMIT - el);
    const t = $app.querySelector('#timer'); if (t) { t.textContent = mmss(S.left); t.classList.toggle('low', S.left <= 20); }
    if (S.left <= 0) finish(false, "Time's up.");
  }
  let toastT = null;
  function toast(msg) { let t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1400); }
  function key(k) {
    if (S.over) return; S.justHint = false;
    if (k === 'BACK') { S.cur = S.cur.slice(0, -1); }
    else if (k === 'ENTER') {
      if (S.cur.length < 5) { toast('Not enough letters'); shake(); return; }
      if (!DICT.has(S.cur)) { toast('Not in word list'); shake(); return; }
      const r = score(S.cur, S.puzzle.word); S.guesses.push({ w: S.cur, r }); S.cur = '';
      if (r.every(x => x === 'ok')) return finish(true, '');
      if (S.guesses.length >= MAX_GUESSES) return finish(false, 'Out of guesses.');
      if (S.hintsShown < MAX_HINTS) { S.hintsShown++; S.justHint = true; toast('Hint ' + S.hintsShown + ' revealed'); }
    }
    else if (/^[A-Z]$/.test(k) && S.cur.length < 5) { S.cur += k; }
    rerender();
  }
  function shake() { const g = $app.querySelector('#grid'); if (g) g.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 }); }
  function finish(solved, msg) {
    if (S.over) return; clearInterval(S.timer); S.over = true; S.solved = solved; S.confirmQuit = false;
    S.elapsed = Math.min(TIME_LIMIT, Math.round((Date.now() - S.startAt) / 1000));
    S.endMsg = solved ? ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'][S.guesses.length - 1] + '! Solved in ' + S.guesses.length + '.' : `${msg} The word was ${S.puzzle.word}.`;
    rerender();
  }
  function submit() {
    if (!S.difficulty || !S.helpful) return;
    S.results = Object.assign({ participantId: S.pid, simulated: false, puzzle: S.puzzle.key, word: S.puzzle.word, guesses: S.guesses.length, solved: S.solved, elapsed: S.elapsed, hintsShown: S.hintsShown, difficulty: S.difficulty, helpful: S.helpful, submittedAt: new Date().toISOString() }, features(S.puzzle.word));
    S.history.push({ round: S.round, word: S.puzzle.word, puzzle: S.puzzle.key, guesses: S.guesses.length, solved: S.solved, hintsShown: S.hintsShown, difficulty: S.difficulty });
    S.step = 'results'; render(); window.scrollTo(0, 0);
  }

  render();
})();
