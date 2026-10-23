/**
 * Puzzle Lab — "What makes a word puzzle difficult, and how could data help us find out?"
 * Google Apps Script backend. Data store: the Google Sheet this script is bound to.
 *
 * SETUP (README.md): run `setup` once, then Deploy > New deployment > Web app (Execute as Me, Anyone).
 *   Student link:  <web app URL>                       (or <url>?code=P3 to prefill the class code)
 *   Teacher link:  <web app URL>?mode=teach&key=<ADMIN KEY>
 */

const SHEETS = {
  Sessions: ['code','name','created_at','stage','word_a','hint1_a','hint2_a','word_b','hint1_b','hint2_b'],
  Attempts: ['code','participant_id','puzzle','word','guesses','solved','elapsed_seconds','hints_shown','rated_difficulty','rated_hint_helpfulness','word_length','vowel_count','repeated_letter_count','submitted_at'],
  Progress: ['code','participant_id','puzzle','guesses','solved','done','elapsed_seconds','hints_shown','updated_at'],
  Settings: ['key','value']
};
const DEFAULT_PUZZLES = {
  A: { word:'TRAIN', hint1:'A form of transportation.', hint2:'It travels on tracks.' },
  B: { word:'APPLE', hint1:'Something you might encounter in everyday life.', hint2:'It comes in different varieties.' }
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name); if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) { sh.appendRow(SHEETS[name]); sh.getRange(1,1,1,SHEETS[name].length).setFontWeight('bold'); sh.setFrozenRows(1); }
  });
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('ADMIN_KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g,'').slice(0,20); props.setProperty('ADMIN_KEY', key); }
  setSetting_('ADMIN_KEY (keep private; use in ?mode=teach&key=...)', key);
  if (rows_('Sessions').length === 0) createSession_('DEMO', 'Demo class', DEFAULT_PUZZLES);
  const url = ScriptApp.getService().getUrl(); if (url) setSetting_('WEB_APP_URL', url);
  Logger.log('Setup complete. ADMIN KEY: ' + key);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const isTeach = p.mode === 'teach' && checkKey_(p.key);
  const boot = { mode: isTeach ? 'teach' : 'student', demo:false, key: isTeach ? p.key : '', code: cleanCode_(p.code || ''), denied: (p.mode === 'teach' && !isTeach) };
  const t = HtmlService.createTemplateFromFile('Index'); t.boot = JSON.stringify(boot);
  return t.evaluate().setTitle('Puzzle Lab').addMetaTag('viewport','width=device-width, initial-scale=1, viewport-fit=cover').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ---------------- student ---------------- */
function getSession(code) {
  const s = findSession_(cleanCode_(code));
  if (!s) return { error: 'No class with that code. Check it with your teacher.' };
  return { code:s.code, name:s.name, puzzles:s.puzzles, stage:s.stage, demo:false };
}
function submitAttempt(code, row) {
  code = cleanCode_(code); const s = findSession_(code);
  if (!s) return { error: 'Class not found.' };
  const pid = cleanId_(row && row.participantId); if (!pid) return { error: 'Missing participant id. Reload the page.' };
  const puzzle = row.puzzle === 'B' ? 'B' : 'A';
  const word = String(row.word || '').toUpperCase().replace(/[^A-Z]/g,'').slice(0,10);
  const guesses = clampInt_(row.guesses, 0, 6), elapsed = clampInt_(row.elapsed, 0, 120), hints = clampInt_(row.hintsShown, 1, 2);
  const diff = clampInt_(row.difficulty, 1, 5), help = clampInt_(row.helpful, 1, 5);
  if (diff == null || help == null) return { error: 'Both ratings are required.' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (err) { return { error: 'Server busy. Tap Submit again.' }; }
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Attempts');
    if (sh.getLastRow() > 1) {
      const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
      if (vals.some(r => String(r[0]) === code && String(r[1]) === pid)) return { ok:true, duplicate:true };
    }
    sh.appendRow([code, pid, puzzle, word, guesses, !!row.solved, elapsed, hints, diff, help, word.length, vowels_(word), repeats_(word), new Date().toISOString()]);
    return { ok:true };
  } finally { lock.releaseLock(); }
}
/** Called after every guess (and at game end). One row per student per class, updated in place. */
function progress(code, row) {
  code = cleanCode_(code); if (!findSession_(code)) return { error: 'Class not found.' };
  const pid = cleanId_(row && row.participantId); if (!pid) return { error: 'Missing participant id.' };
  const vals = [code, pid, row.puzzle === 'B' ? 'B' : 'A', clampInt_(row.guesses, 0, 6) || 0, !!row.solved, !!row.done, clampInt_(row.elapsed, 0, 120) || 0, clampInt_(row.hintsShown, 1, 2) || 1, new Date().toISOString()];
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return { ok: false, busy: true }; }
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Progress');
    let rowIdx = 0;
    if (sh.getLastRow() > 1) { const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues(); for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === code && String(ids[i][1]) === pid) { rowIdx = i + 2; break; } }
    if (rowIdx) sh.getRange(rowIdx, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function progress_(code) {
  return rows_('Progress').filter(r => String(r.code) === code).map(r => ({ participantId:String(r.participant_id), puzzle:String(r.puzzle), guesses:Number(r.guesses), solved: r.solved === true || String(r.solved).toUpperCase() === 'TRUE', done: r.done === true || String(r.done).toUpperCase() === 'TRUE', elapsed:Number(r.elapsed_seconds), hintsShown:Number(r.hints_shown), updatedAt:String(r.updated_at), simulated: String(r.participant_id).indexOf('test-') === 0 }));
}
function getResults(code) {
  code = cleanCode_(code); const s = findSession_(code);
  if (!s) return { error: 'Class not found.' };
  return { code:s.code, puzzles:s.puzzles, stage:s.stage, attempts: attempts_(code), progress: progress_(code), demo:false };
}

/* ---------------- teacher ---------------- */
function admin(key, action, data) {
  if (!checkKey_(key)) return { error: 'Not authorized (bad or missing key).' };
  data = data || {};
  switch (action) {
    case 'list': {
      const counts = {}; rows_('Attempts').forEach(r => counts[r.code] = (counts[r.code] || 0) + 1);
      return { sessions: rows_('Sessions').map(r => ({ code:String(r.code), name:String(r.name), createdAt:String(r.created_at), stage:Number(r.stage)||1, n:counts[String(r.code)]||0 })).reverse(), url: ScriptApp.getService().getUrl(), demo:false };
    }
    case 'create': {
      let code = cleanCode_(data.code); if (!code) code = 'C' + Utilities.getUuid().replace(/[^A-Z0-9]/gi,'').slice(0,3).toUpperCase();
      if (findSession_(code)) return { error: 'Code ' + code + ' already exists. Pick another.' };
      const pz = cleanPuzzles_(data.puzzles); if (pz.error) return pz;
      createSession_(code, cleanText_(data.name) || code, pz);
      return { ok:true, code };
    }
    case 'savePuzzles': {
      const row = findRow_('Sessions', 'code', cleanCode_(data.code)); if (!row) return { error: 'Class not found.' };
      const pz = cleanPuzzles_(data.puzzles); if (pz.error) return pz;
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions');
      sh.getRange(row, 5, 1, 6).setValues([[pz.A.word, pz.A.hint1, pz.A.hint2, pz.B.word, pz.B.hint1, pz.B.hint2]]);
      return { ok:true };
    }
    case 'setStage': {
      const row = findRow_('Sessions', 'code', cleanCode_(data.code)); if (!row) return { error: 'Class not found.' };
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions').getRange(row, 4).setValue(clampInt_(data.stage, 1, 6) || 1);
      return { ok:true };
    }
    case 'clear': {
      const code = cleanCode_(data.code);
      ['Attempts','Progress'].forEach(name => { const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
        if (sh.getLastRow() > 1) { const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues(); for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]) === code) sh.deleteRow(i + 2); } });
      return { ok:true };
    }
    default: return { error: 'Unknown action: ' + action };
  }
}

/* ---------------- helpers ---------------- */
function rows_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  const cols = SHEETS[name];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().map(r => { const o = {}; cols.forEach((c, i) => o[c] = r[i]); return o; });
}
function findRow_(sheet, col, value) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet); const ci = SHEETS[sheet].indexOf(col);
  if (sh.getLastRow() < 2) return 0;
  const vals = sh.getRange(2, ci + 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2;
  return 0;
}
function findSession_(code) {
  const r = rows_('Sessions').find(x => String(x.code) === code); if (!r) return null;
  return { code:String(r.code), name:String(r.name), stage:Number(r.stage)||1, puzzles:{ A:{word:String(r.word_a), hint1:String(r.hint1_a), hint2:String(r.hint2_a)}, B:{word:String(r.word_b), hint1:String(r.hint1_b), hint2:String(r.hint2_b)} } };
}
function createSession_(code, name, pz) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sessions').appendRow([code, name, new Date().toISOString(), 1, pz.A.word, pz.A.hint1, pz.A.hint2, pz.B.word, pz.B.hint1, pz.B.hint2]);
}
function attempts_(code) {
  return rows_('Attempts').filter(r => String(r.code) === code).map(r => ({ participantId:String(r.participant_id), puzzle:String(r.puzzle), word:String(r.word), guesses:Number(r.guesses), solved: r.solved === true || String(r.solved).toUpperCase() === 'TRUE',
    elapsed:Number(r.elapsed_seconds), hintsShown:Number(r.hints_shown), difficulty:Number(r.rated_difficulty), helpful:Number(r.rated_hint_helpfulness), wordLength:Number(r.word_length), vowelCount:Number(r.vowel_count), repeatCount:Number(r.repeated_letter_count), submittedAt:String(r.submitted_at), simulated: String(r.participant_id).indexOf('test-') === 0 }));
}
function cleanPuzzles_(p) {
  p = p || DEFAULT_PUZZLES; const out = {};
  for (const k of ['A','B']) {
    const w = String((p[k] && p[k].word) || '').toUpperCase().replace(/[^A-Z]/g,'');
    if (w.length !== 5) return { error: 'Puzzle ' + k + ' needs exactly five letters.' };
    out[k] = { word:w, hint1:cleanText_(p[k].hint1), hint2:cleanText_(p[k].hint2) };
  }
  return out;
}
function getSetting_(key) { const r = rows_('Settings').find(x => String(x.key) === key); return r ? String(r.value) : ''; }
function setSetting_(key, value) { const row = findRow_('Settings', 'key', key); const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings'); if (row) sh.getRange(row, 2).setValue(value); else sh.appendRow([key, value]); }
function checkKey_(key) { const k = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY'); return !!k && !!key && String(key) === k; }
function cleanCode_(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); }
function cleanId_(s) { return String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g,'').slice(0,64); }
function cleanText_(s) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g,'').slice(0,300); }
function clampInt_(x, lo, hi) { const n = Math.round(Number(x)); if (isNaN(n)) return null; return Math.max(lo, Math.min(hi, n)); }
function vowels_(w) { return (w.match(/[AEIOU]/g) || []).length; }
function repeats_(w) { return w.length - new Set(w.split('')).size; }

/* ---------------- test data ---------------- */
/** Adds 12 fake attempts (participant ids start with "test-") to the class whose code you pass, e.g. addTestAttempts('DEMO'). */
function addTestAttempts(code) {
  code = cleanCode_(code || 'DEMO'); const s = findSession_(code); if (!s) throw new Error('No class ' + code);
  for (let i = 0; i < 12; i++) {
    const k = i % 2 ? 'B' : 'A'; const solved = Math.random() < (k === 'A' ? .85 : .5); const g = solved ? 2 + Math.floor(Math.random() * 4) : 6;
    const pid = 'test-' + i + '-' + Math.floor(Math.random()*1e6);
    progress(code, { participantId:pid, puzzle:k, guesses:g, solved, done:true, elapsed: solved ? 30 + Math.floor(Math.random()*80) : 120, hintsShown: g > 2 ? 2 : 1 });
    submitAttempt(code, { participantId:pid, puzzle:k, word:s.puzzles[k].word, guesses:g, solved, elapsed: solved ? 30 + Math.floor(Math.random()*80) : 120, hintsShown: g > 2 ? 2 : 1,
      difficulty: Math.max(1, Math.min(5, Math.round((k === 'A' ? 2 : 3.8) + (Math.random() - .5) * 2.4))), helpful: Math.max(1, Math.min(5, Math.round((k === 'A' ? 4.2 : 2.2) + (Math.random() - .5) * 2.2))) });
  }
}
/** Deletes every attempt whose participant id starts with "test-". */
function removeTestAttempts() {
  ['Attempts','Progress'].forEach(name => { const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); if (sh.getLastRow() < 2) return;
    const vals = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).indexOf('test-') === 0) sh.deleteRow(i + 2); });
}
