/* Puzzle Lab — teacher app. No backend: settings live in this browser (localStorage), the class is simulated, and the
   teacher's words reach student phones through the QR code's URL (?code=…&p=…). */
(function () {
  'use strict';
  const { esc, vowels, repeats, mmss, TIME_LIMIT, MAX_HINTS, SIM_PLAYERS, BANK, DEFAULT_PUZZLES, DICT, cleanPuzzles, encodePuzzles, studentUrl, simulateClass, progressAt, attemptsAt,
    exampleRow, classBlock, simBlock, bindSim, whyBlock, wrapBlock, toCSV, store, cleanCode } = window.PL;
  const $app = document.getElementById('app');
  const CFG_KEY = 'pl_teacher_cfg';
  const isFile = location.protocol === 'file:';

  function defaultStudentUrl() {
    const base = location.href.split('#')[0].split('?')[0];
    if (/\/teacher\/(index\.html)?$/.test(base)) return base.replace(/\/teacher\/(index\.html)?$/, '/student/');
    return base.replace(/[^/]*$/, '') + '../student/';
  }
  const saved = store.get(CFG_KEY, {});
  const T = { tab: 'present', code: cleanCode(saved.code) || 'P1', puzzles: cleanPuzzles(saved.puzzles), base: saved.base || defaultStudentUrl(), nSim: saved.nSim || SIM_PLAYERS, variant: saved.variant || 0,
    stage: 1, t10: 0, t10run: false, t2: TIME_LIMIT, t2run: false, simT: 0, simRun: false, sims: [], msg: null, err: null, xAxis: 'fam', trend: true, sel: null, find: '', draft: null };
  const STAGES = [[1, '0:00', 'Intro & assign'], [2, '1:00', 'Play (live)'], [3, '3:00', 'Rate'], [4, '4:00', 'Class results'], [5, '6:00', '1,000 words'], [6, '8:00', 'Discuss'], [7, '9:00', 'Wrap-up']];

  function persist() { store.set(CFG_KEY, { code: T.code, puzzles: T.puzzles, base: T.base, nSim: T.nSim, variant: T.variant }); }
  function regen() { T.sims = simulateClass(T.puzzles, T.nSim, T.variant); }
  const link = () => studentUrl(T.base, T.code, T.puzzles, T.nSim, T.variant);
  const simClock = () => T.stage >= 4 ? Infinity : T.simT;
  const results = t => ({ puzzles: T.puzzles, attempts: attemptsAt(T.sims, t == null ? simClock() : t), progress: progressAt(T.sims, t == null ? simClock() : t) });

  /* ---------- render ---------- */
  function render() {
    const tabs = [['present', 'Present'], ['setup', 'Setup'], ['data', 'Data']];
    $app.innerHTML = `<div class="stack fade">
    <div class="brand"><b>Puzzle Lab <span class="muted" style="font-weight:400">· teacher</span></b><div class="row"><span class="pill">Class <b>${esc(T.code)}</b></span><span class="pill warn">${T.sims.length} simulated players</span></div></div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab" data-tab="${k}" aria-pressed="${T.tab === k}">${l}</button>`).join('')}</div>
    ${T.msg ? `<div class="notice info">${esc(T.msg)}</div>` : ''}${T.err ? `<div class="err">${esc(T.err)}</div>` : ''}
    ${T.tab === 'setup' ? viewSetup() : T.tab === 'data' ? viewData() : viewPresent()}</div>`;
    bind();
  }
  function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }

  function viewSetup() {
    const p = T.draft || T.puzzles;
    const pz = k => `<div class="card stack"><div class="eyebrow">Puzzle ${k} ${k === 'A' ? '(even birthdays · intended easier, specific hints)' : '(odd birthdays · intended harder, vague hints)'}</div>
    <div class="row"><label class="f grow">Five-letter word (must be in Wordle's word list)<input data-p="${k}.word" maxlength="5" autocapitalize="characters" value="${esc(p[k].word)}"></label>
      <label class="f">Fill from bank<select data-bank="${k}"><option value="">Pick a word…</option>${BANK[k].map(e => `<option value="${e.word}">${e.word}</option>`).join('')}</select></label></div>
    <div class="hintfields">${p[k].hints.map((h, i) => `<label class="f">Hint ${i + 1}${i === 0 ? ' (after the first wrong guess)' : i === MAX_HINTS - 1 ? ' (most revealing)' : ''}<input data-p="${k}.h${i}" value="${esc(h)}"></label>`).join('')}</div>
    <p class="tiny">${vowels(p[k].word)} vowels · ${repeats(p[k].word)} repeated · ${p[k].word.length === 5 && DICT.has(p[k].word) ? 'in word list' : '<span style="color:var(--bad)">not in word list</span>'}. Students see no hint until they miss; each miss reveals the next hint, up to ${MAX_HINTS}.</p></div>`;
    return `<div class="setupgrid">
    <div class="stack">
      <div class="card stack"><h3>Class</h3>
        <label class="f">Class code (shown on the projector; students type it)<input id="code" maxlength="6" autocapitalize="characters" value="${esc(T.code)}" style="max-width:200px"></label>
        <label class="f">Student app address (the QR code points here)<input id="base" value="${esc(T.base)}"></label>
        ${isFile ? `<div class="notice">This page was opened from a file, so phones can't reach it. Serve the project folder over the web (for example <code>python3 -m http.server</code> in the project folder, or any static host) and open the teacher app from that address; the student address then fills in automatically.</div>` : ''}
        <div class="eyebrow">Link students will open</div><p class="urlbox muted">${esc(link())}</p>
        <div class="row"><button class="btn sm" id="copy">Copy student link</button><a class="btn sm ghost" href="${esc(link())}" target="_blank" rel="noopener">Open student app</a></div>
        <p class="tiny">The link carries your words and hints, so students who scan the QR code or open this exact link get them. Students who type only the address get the default words (${DEFAULT_PUZZLES.A.word} / ${DEFAULT_PUZZLES.B.word}).</p>
      </div>
      <div class="card stack"><h3>Simulated class</h3>
        <label class="f">Number of simulated players<input id="nsim" type="number" min="6" max="60" value="${T.nSim}" style="max-width:120px"></label>
        <div class="row"><button class="btn sm" id="shuffle">Shuffle simulated players</button></div>
        <p class="tiny">Simulated players are generated from the two words, the player count, and a shuffle number, all carried in the student link. So every phone that scans the QR code sees exactly the class on this screen.</p>
      </div>
    </div>
    <div class="stack">${pz('A')}${pz('B')}
      <div class="row"><button class="btn primary" id="save">Save class settings</button><button class="btn ghost" id="reset">Reset to defaults</button></div>
      <p class="tiny">Saving regenerates the simulated class and the QR code. Settings stay in this browser.</p></div></div>`;
  }
  function viewData() {
    const att = attemptsAt(T.sims, Infinity);
    return `<div class="card stack"><div class="row spread"><h3>Attempts for ${esc(T.code)}</h3><div class="row"><span class="pill">${att.length} rows</span><button class="btn sm" id="csv">Download CSV</button></div></div>
    <div class="tablewrap"><table><thead><tr><th>Puzzle</th><th>Word</th><th>Guesses</th><th>Solved</th><th>Time</th><th>Hints</th><th>Difficulty</th><th>Hint help</th><th>Length</th><th>Vowels</th><th>Repeats</th><th>Sim?</th></tr></thead><tbody>
    ${att.map(a => `<tr><td>${esc(a.puzzle)}</td><td>${esc(a.word)}</td><td class="num">${a.guesses}</td><td>${a.solved ? 'yes' : 'no'}</td><td class="num">${mmss(a.elapsed)}</td><td class="num">${a.hintsShown}</td><td class="num">${a.difficulty}</td><td class="num">${a.helpful}</td><td class="num">${a.wordLength}</td><td class="num">${a.vowelCount}</td><td class="num">${a.repeatCount}</td><td>${a.simulated ? 'sim' : ''}</td></tr>`).join('') || '<tr><td colspan="12" class="tiny">No attempts yet.</td></tr>'}
    </tbody></table></div><p class="tiny">${T.sims.length - att.length} simulated player${T.sims.length - att.length === 1 ? '' : 's'} played but never submitted ratings, which is what happens in a real class too. Real student phones keep their own data on the phone; nothing is sent here.</p></div>`;
  }
  function liveBoard(r) {
    const prog = r.progress; const by = { A: prog.filter(p => p.puzzle === 'A'), B: prog.filter(p => p.puzzle === 'B') };
    const col = k => {
      const a = by[k]; const playing = a.filter(p => !p.done).length, solved = a.filter(p => p.solved).length, failed = a.filter(p => p.done && !p.solved).length;
      const dist = [0, 0, 0, 0, 0, 0, 0]; a.forEach(p => dist[Math.min(6, p.guesses)]++); const mx = Math.max(1, ...dist);
      const W = 360, H = 150, L = 28, B = 38; const bw = (W - L - 10) / 7;
      const bars = dist.map((d, i) => `<rect class="bar" x="${L + i * bw + 4}" y="${H - B - (d / mx) * (H - B - 14)}" width="${bw - 8}" height="${(d / mx) * (H - B - 14)}" rx="2"/><text x="${L + i * bw + bw / 2}" y="${H - B + 16}" text-anchor="middle">${i}</text>${d ? `<text x="${L + i * bw + bw / 2}" y="${H - B - (d / mx) * (H - B - 14) - 4}" text-anchor="middle" class="lab">${d}</text>` : ''}`).join('');
      return `<div class="card stack"><div class="row spread"><h3>Puzzle ${k} · ${esc(T.puzzles[k].word)}</h3><span class="pill">${a.length} player${a.length === 1 ? '' : 's'}</span></div>
      <div class="stat"><div><b class="num">${playing}</b><span>still playing</span></div><div><b class="num">${solved}</b><span>solved</span></div><div><b class="num">${failed}</b><span>not solved</span></div></div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Guesses so far, Puzzle ${k}">${bars}<text x="${L + (W - L) / 2}" y="${H - 4}" text-anchor="middle" style="font-size:11px">guesses used so far</text></svg>
      <div class="mini" aria-label="one square per player">${a.map(p => `<span class="${p.solved ? 'done' : p.done ? 'fail' : ''}" title="${p.guesses} guesses, ${p.hintsShown} hints">${p.guesses}</span>`).join('')}</div></div>`;
    };
    return `<div class="live">${col('A')}${col('B')}</div><p class="tiny">Each square is one simulated student's guess count so far: green = solved, gray = finished without solving. The board follows the play timer: start it and the class plays in front of you.${T.simT === 0 && !T.simRun ? ' <b>Start the play timer to begin.</b>' : ''}</p>`;
  }
  function viewPresent() {
    const r = results(); const st = T.stage;
    const stageBar = `<div class="chips">${STAGES.map(([n, t, l]) => `<button class="chip" data-stage="${n}" aria-pressed="${st === n}"><span class="num muted">${t}</span>&nbsp;${l}</button>`).join('')}</div>`;
    const timers = `<div class="card row spread"><div class="row" style="gap:16px"><div><div class="eyebrow">Activity clock</div><div class="timer num" id="t10">${mmss(T.t10)}</div></div><button class="btn sm" id="t10go">${T.t10run ? 'Pause' : 'Start'}</button><button class="btn sm ghost" id="t10reset">Reset</button></div>
    <div class="row" style="gap:16px"><div><div class="eyebrow">Play timer (2:00)</div><div class="timer num ${T.t2 <= 20 ? 'low' : ''}" id="t2">${mmss(T.t2)}</div></div><button class="btn sm" id="t2go">${T.t2run ? 'Pause' : 'Start'}</button><button class="btn sm ghost" id="t2reset">Reset</button></div>
    <div><div class="eyebrow">Submitted</div><div class="timer num" id="nsub">${r.attempts.length}</div></div></div>`;
    let body = '';
    if (st === 1) body = `<div class="cols"><div class="card stack present"><h2>Scan or type the class code</h2><div class="codebig">${esc(T.code)}</div><div id="qrbox" class="qrbox"></div><p class="muted small urlbox">${esc(link())}</p>${isFile ? '<p class="notice">Opened from a file: phones can\'t reach this address. See Setup.</p>' : ''}</div>
    <div class="card stack present"><h2>Can you crack a five-letter word?</h2><p>Type the <b>day of the month you were born</b>. That picks your puzzle: A or B.</p><p>6 guesses · 2 minutes · real words only · <b>no hint until you miss</b>; each wrong guess reveals one, up to ${MAX_HINTS}.</p>${exampleRow('TRACK', 'CRANE')}<p class="small">If the word were CRANE and you guessed TRACK: ✓ placed, ~ in the word elsewhere, ✕ not in the word.</p></div></div>`;
    else if (st === 2) body = `<div class="card stack present" style="text-align:center;padding:24px 16px"><h2>Play!</h2><div class="big num ${T.t2 <= 20 ? 'low' : ''}" id="t2big">${mmss(T.t2)}</div></div>${liveBoard(r)}`;
    else if (st === 3) body = `<div class="card stack present" style="text-align:center;padding:30px 16px"><h2>Rate it, then submit</h2><p>How difficult did it feel (1–5)? How helpful were the hints (1–5)?</p><p class="muted">Submitted: <b class="num">${r.attempts.length}</b> of ${r.progress.length} who played</p></div>`;
    else if (st === 4) body = `<div class="present">${classBlock(r, null, true)}</div>`;
    else if (st === 5) body = `<div class="present">${simBlock(T, true, [T.puzzles.A.word, T.puzzles.B.word])}</div>`;
    else if (st === 6) body = `<div class="present">${whyBlock()}</div>`;
    else body = wrapBlock(r);
    return `${stageBar}${timers}${body}`;
  }

  /* ---------- events ---------- */
  function bind() {
    const q = s => $app.querySelector(s);
    $app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { T.tab = b.dataset.tab; T.msg = T.err = null; T.draft = null; render(); window.scrollTo(0, 0); }));
    $app.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => { T.stage = +b.dataset.stage; if (T.stage === 2 && !T.t2run && T.t2 === TIME_LIMIT) { T.t2run = true; T.simRun = true; } if (T.stage >= 4) T.simT = Math.max(T.simT, 9999); render(); window.scrollTo(0, 0); }));
    q('#t10go')?.addEventListener('click', () => { T.t10run = !T.t10run; rerender(); });
    q('#t10reset')?.addEventListener('click', () => { T.t10 = 0; T.t10run = false; rerender(); });
    q('#t2go')?.addEventListener('click', () => { T.t2run = !T.t2run; T.simRun = T.t2run; rerender(); });
    q('#t2reset')?.addEventListener('click', () => { T.t2 = TIME_LIMIT; T.t2run = false; T.simRun = false; T.simT = 0; rerender(); });
    if (T.tab === 'present') { bindSim($app, T, rerender); if (T.stage === 1) drawQR(); }
    if (T.tab === 'setup') {
      q('#code')?.addEventListener('input', e => { T.code = cleanCode(e.target.value); });
      q('#base')?.addEventListener('change', e => { T.base = e.target.value.trim(); persist(); rerender(); });
      q('#nsim')?.addEventListener('change', e => { T.nSim = Math.max(6, Math.min(60, parseInt(e.target.value, 10) || SIM_PLAYERS)); });
      q('#shuffle')?.addEventListener('click', () => { T.variant++; persist(); regen(); T.simT = 0; T.simRun = false; T.t2 = TIME_LIMIT; T.t2run = false; T.msg = 'Simulated players shuffled. The QR code now carries the new set.'; rerender(); });
      q('#copy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(link()); T.msg = 'Student link copied.'; } catch (e) { T.err = 'Could not copy automatically. Select the link text and copy it.'; } rerender(); });
      $app.querySelectorAll('[data-p]').forEach(i => i.addEventListener('input', () => { T.draft = readDraft(); if (i.dataset.p.endsWith('.word')) rerender(); }));
      $app.querySelectorAll('[data-bank]').forEach(s => s.addEventListener('change', () => { const e = BANK[s.dataset.bank].find(x => x.word === s.value); if (!e) return; const d = readDraft(); d[s.dataset.bank] = { word: e.word, hints: e.hints.slice() }; T.draft = d; rerender(); }));
      q('#save')?.addEventListener('click', () => {
        const d = readDraft(); T.err = null;
        for (const k of ['A', 'B']) { if (d[k].word.length !== 5 || !DICT.has(d[k].word)) { T.err = `Puzzle ${k}: "${d[k].word}" is not in Wordle's word list, so students could never guess it. Pick another.`; rerender(); return; } if (d[k].hints.some(h => !h.trim())) { T.err = `Puzzle ${k}: fill in all ${MAX_HINTS} hints.`; rerender(); return; } }
        if (d.A.word === d.B.word) { T.err = 'Puzzles A and B need different words.'; rerender(); return; }
        if (!T.code) T.code = 'P1';
        T.puzzles = d; T.draft = null; persist(); regen(); T.simT = 0; T.simRun = false; T.t2 = TIME_LIMIT; T.t2run = false; T.msg = 'Saved. The QR code and simulated class now use these words.'; rerender();
      });
      q('#reset')?.addEventListener('click', () => { T.draft = cleanPuzzles(null); T.nSim = SIM_PLAYERS; T.msg = 'Defaults loaded. Save to keep them.'; rerender(); });
    }
    if (T.tab === 'data') q('#csv')?.addEventListener('click', () => { const blob = new Blob([toCSV(T.code, attemptsAt(T.sims, Infinity))], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `puzzle-lab-${T.code}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  }
  function readDraft() {
    const p = JSON.parse(JSON.stringify(T.draft || T.puzzles));
    $app.querySelectorAll('[data-p]').forEach(i => { const [k, f] = i.dataset.p.split('.'); if (f === 'word') p[k].word = i.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); else p[k].hints[+f.slice(1)] = i.value; });
    return p;
  }
  function tick() {
    if (T.t10run) T.t10++;
    let ended = false; if (T.t2run && T.t2 > 0) { T.t2--; if (T.t2 === 0) { T.t2run = false; ended = true; } }
    if (T.simRun) T.simT++;
    const a = $app.querySelector('#t10'); if (a) a.textContent = mmss(T.t10);
    const b = $app.querySelector('#t2'); if (b) { b.textContent = mmss(T.t2); b.classList.toggle('low', T.t2 <= 20); }
    const c = $app.querySelector('#t2big'); if (c) { c.textContent = mmss(T.t2); c.classList.toggle('low', T.t2 <= 20); }
    if (ended || (T.simRun && T.tab === 'present' && (T.stage === 2 || T.stage === 3))) rerender();
    else { const n = $app.querySelector('#nsub'); if (n) n.textContent = results().attempts.length; }
  }
  function drawQR() {
    const box = $app.querySelector('#qrbox'); if (!box) return; box.innerHTML = '';
    if (!window.QRCode) { box.innerHTML = '<p class="tiny">QR library missing (assets/js/vendor/qrcode.min.js).</p>'; return; }
    try { new QRCode(box, { text: link(), width: 280, height: 280, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { box.innerHTML = '<p class="tiny">Could not draw the QR code (link too long?). Shorten the hints or share the link instead.</p>'; }
  }

  regen(); render(); setInterval(tick, 1000);
})();
