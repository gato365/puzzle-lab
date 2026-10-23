# Puzzle Lab

A Wordle-style class activity: each student gets Puzzle A (even birthday day) or Puzzle B (odd), plays once, rates it, and the class compares the two groups. Two small web apps, no server, no accounts, no Google anything.

```
index.html              launcher page linking to both apps
teacher/index.html      projector app: QR code, timers, live board, results, 1,000-word plot, wrap-up
student/index.html      phone app: play, rate, see the class, play again
assets/css/             base.css (shared), teacher.css, student.css
assets/js/core.js       game logic, simulated class, charts, lesson text (shared)
assets/js/teacher.js    teacher app
assets/js/student.js    student app
assets/js/data/         dict.js (12,972 valid guesses), words1000.js (1,000-word dataset), bank.js (32 words with 4 hints each)
assets/js/vendor/       qrcode.min.js (QR generator, works offline)
legacy/                 the old Google Apps Script version (Code.gs, Index.html), kept for reference only
```

## How the pieces fit together

- **No backend.** The teacher app keeps its settings in the browser (localStorage). Each phone keeps its own game on the phone. Nothing is sent anywhere.
- **The class is simulated.** The teacher app and every phone generate the same simulated classmates from the two words, the player count, and a shuffle number (default 28 players). A student's own result is added to that class as a green dot.
- **Words travel in the QR code.** The teacher's words, hints, player count, and shuffle number are encoded in the student link (`?code=…&p=…&n=…&v=…`). Students who scan the QR code get exactly what the teacher set. Students who only type the address get the defaults (TRAIN / APPLE).
- **Hints are earned.** No hint at the start. Each wrong guess reveals the next hint, up to 4. The number of hints seen is recorded with every attempt.
- **Play again means a new word.** The phone remembers every word it has shown and draws unused ones from the bank (16 per group). Students keep their group (A or B).

## Hosting (2 minutes)

Phones have to be able to reach the student app, so put the folder on any static web host (GitHub Pages, Netlify, a school web server, or a laptop on the classroom Wi-Fi).

Quick local option, on the laptop that will run the projector:

```
cd project-213-worlde-quick
python3 -m http.server 8000
```

Then open `http://<this laptop's IP>:8000/teacher/` in the browser. The teacher app fills in the student address automatically from its own address; check it on the Setup tab. If you opened the file directly (address starts with `file://`), the QR code can't work, and the app says so.

## Before class (3 minutes)

1. Teacher app → **Setup**. Set the class code (e.g. `P3`).
2. Pick the words. Defaults are TRAIN (A, specific hints) and APPLE (B, vague hints). "Fill from bank" loads a word with its four hints; you can edit any hint. Words must be in Wordle's word list.
3. Optionally change the number of simulated players or shuffle them.
4. **Save class settings.** The QR code and the simulated class now use these words.

## In class: the 10 minutes

Teacher app → **Present**. Click a stage; content and timers are projector-sized.

| Stage | Clock | On the projector | Students |
|---|---|---|---|
| Intro & assign | 0:00 | Class code + QR code, the rules, the feedback example | Scan, enter birthday day, read the example |
| Play (live) | 1:00 | Big 2:00 timer (auto-starts) and the live board: simulated players guess, solve, or time out in step with the timer | Play (their phone has its own 2:00) |
| Rate | 3:00 | "Submitted" counter climbs as simulated players finish rating | Two 1–5 ratings, Submit |
| Class results | 4:00 | Dot plot A vs B, solve rates, hints seen, discussion prompts, the two-things-changed caveat | Same on their phone, with their own dot in green |
| 1,000 words | 6:00 | 1,000 real Wordle answers; real features on the x-axis, simulated ratings on the y-axis; your two words marked | Same, on the "1,000 words" tab |
| Discuss | 8:00 | Outcome / feature / variation; the final question | "Why it matters" tab |
| Wrap-up | 9:00 | Six-point recap with the class's averages and solve rates filled in, the three words to keep, the exit question | Play again with a new word, if there is time |

The **Data** tab shows every simulated attempt and downloads it as CSV (same columns as before: code, participant_id, puzzle, word, guesses, solved, elapsed_seconds, hints_shown, rated_difficulty, rated_hint_helpfulness, word_length, vowel_count, repeated_letter_count, simulated).

## Test checklist
- [ ] Teacher Setup: a word not in the list (ZZZZZ) is refused; A and B must differ; all four hints required.
- [ ] Teacher Present → Intro shows a QR code; scanning it opens the student app with the class code filled in and the teacher's words.
- [ ] Student: even day gives Puzzle A, odd gives B (words never labeled easy/hard).
- [ ] Student: no hint before the first guess; Hint 1 appears after the first wrong guess; Hint 4 after the fourth; nothing more after that.
- [ ] Typing a non-word (ZZZZZ) shows "Not in word list" and doesn't use a guess.
- [ ] "Give up" asks for confirmation; time-out, give-up, and six misses all count as not solved.
- [ ] Rate screen shows "hints shown"; Submit shows the class with your dot in green and "1 real + N simulated".
- [ ] "Play again with a new word" never repeats a word already shown on that phone (both A and B words of every round count as shown). After the bank runs out, the app says words may repeat.
- [ ] Teacher Present → Play (live): start the play timer; squares fill in over the two minutes; the Submitted counter rises during Rate; Class results shows everyone.
- [ ] The teacher's Class results and a phone that scanned the QR code show the same simulated dots.

## Notes
- The 1,000-word scatterplot uses the first 1,000 words of Wordle's official answer list with **real** features (word familiarity from word-frequency data, vowels, repeated letters, rare letters) and **simulated** difficulty ratings, labeled as such everywhere it appears.
- Birthday parity is a convenience assignment, not randomization; the app says so on the wrap-up.
- Because there is no server, real student results stay on each phone. The projector's dots are the simulated class. If you want to collect real class data, the old Google Apps Script version in `legacy/` did that with a Google Sheet.
