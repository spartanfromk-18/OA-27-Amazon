/* ============================================================
   OA Trainer — app logic
   DATA is injected above this file by build.py (no fetch()).
   State is held in memory only; nothing is persisted between reloads.
   ============================================================ */
(function () {
  'use strict';

  var SECTIONS = DATA.meta.sections;
  var TOTAL_MIN = SECTIONS.reduce(function (a, s) {
    return a + s.minutes;
  }, 0);

  /* Optional dev override for timer testing: ?fast=SECONDS */
  var FAST = (function () {
    var m = /(?:\?|&)fast=(\d+)/.exec(location.search);
    return m ? parseInt(m[1], 10) : null;
  })();

  /* Leadership Principle mapping for the Workstyles section.
     Both statements in every pair are genuine, positively-framed LP behaviors —
     this is a forced choice between two principles, never a "principle vs. nothing"
     choice. Encoding only one side (as the previous version did) silently implies
     the other side is the "wrong" answer, which contradicts the section's own
     design goal of reading consistency rather than correctness. */
  var WORKSTYLE_MAP = [
    { a: { lp: 'Are Right, A Lot', tag: 'validate before committing' }, b: { lp: 'Bias for Action', tag: 'act and adjust' } },
    { a: { lp: 'Deliver Results', tag: 'depth over breadth' }, b: { lp: 'Ownership', tag: 'work outside your scope' } },
    { a: { lp: 'Dive Deep', tag: 'self-gathered data' }, b: { lp: 'Earn Trust', tag: 'lean on trusted expertise' } },
    { a: { lp: 'Have Backbone; Disagree and Commit', tag: 'raise disagreement early' }, b: { lp: 'Earn Trust', tag: 'relationship-first candor' } },
    { a: { lp: 'Insist on the Highest Standards', tag: 'well-specified execution' }, b: { lp: 'Ownership', tag: 'outcome over instructions' } },
    { a: { lp: 'Bias for Action', tag: 'ship and iterate' }, b: { lp: 'Insist on the Highest Standards', tag: 'quality bar over speed' } },
    { a: { lp: 'Dive Deep', tag: 'dig into details yourself' }, b: { lp: 'Hire and Develop the Best', tag: 'leverage and grow others' } },
    { a: { lp: 'Invent and Simplify', tag: 'energised by ambiguity' }, b: { lp: 'Deliver Results', tag: 'execution against clear scope' } },
    { a: { lp: 'Earn Trust', tag: 'share your mistakes' }, b: { lp: 'Ownership', tag: 'resolve and move on independently' } },
    { a: { lp: 'Insist on the Highest Standards', tag: 'long-term maintainability' }, b: { lp: 'Deliver Results', tag: 'honor the current commitment' } },
    { a: { lp: 'Are Right, A Lot', tag: 'seek contradicting feedback' }, b: { lp: 'Have Backbone; Disagree and Commit', tag: 'commit fully once decided' } },
    { a: { lp: 'Ownership', tag: 'take unglamorous work' }, b: { lp: 'Deliver Results', tag: 'prioritise highest-leverage work' } }
  ];

  var LP_ORDER = [
    'Ownership',
    'Bias for Action',
    'Dive Deep',
    'Earn Trust',
    'Have Backbone; Disagree and Commit',
    'Insist on the Highest Standards',
    'Invent and Simplify',
    'Are Right, A Lot',
    'Deliver Results',
    'Hire and Develop the Best'
  ];

  /* ---------- state ---------- */
  var state = null;
  function freshState() {
    return {
      screen: 'landing',
      queue: [],
      qidx: 0,
      mode: 'single',
      answers: {},
      code: {},
      used: {},
      results: {},
      cur: 0,
      reached: 0,
      hint: {},
      total: 0,
      remaining: 0,
      deadline: 0,
      timerId: null,
      pending: null
    };
  }
  state = freshState();

  /* ---------- dom refs ---------- */
  var main = document.getElementById('main');
  var timerEl = document.getElementById('timer');
  var timerValue = document.getElementById('timer-value');
  var timerMeta = document.getElementById('timer-meta');
  var timerFill = document.getElementById('timer-fill');
  var timerLabel = document.getElementById('timer-label');
  var chip = document.getElementById('section-chip');
  var live = document.getElementById('live');

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  /* escape + render `inline code` spans */
  function md(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code class="inline">$1</code>');
  }
  function sectionMeta(id) {
    for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return SECTIONS[i];
    return null;
  }
  function items(id) {
    return DATA[id] || [];
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60),
      s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function letter(i) {
    return ['A', 'B', 'C', 'D', 'E'][i] || String(i + 1);
  }
  function announce(msg) {
    live.textContent = msg;
  }
  function answersFor(id) {
    if (!state.answers[id]) {
      var arr = [];
      for (var i = 0; i < items(id).length; i++) arr.push(null);
      state.answers[id] = arr;
    }
    return state.answers[id];
  }
  function answeredCount(id) {
    return answersFor(id).filter(function (v) {
      return v !== null && v !== undefined;
    }).length;
  }
  function codeLines(src) {
    var rows = String(src).split('\n');
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      html +=
        '<tr><td class="ln">' +
        (i + 1) +
        '</td><td class="src">' +
        (esc(rows[i]) || ' ') +
        '</td></tr>';
    }
    return (
      '<div class="code"><div class="code__bar"><span>buggy snippet</span><span>' +
      rows.length +
      ' lines</span></div><div class="code__scroll" tabindex="0" role="group" aria-label="Code snippet, scrollable"><table>' +
      html +
      '</table></div></div>'
    );
  }

  /* ---------- theme ---------- */
  (function theme() {
    var btn = document.querySelector('[data-theme-toggle]');
    var root = document.documentElement;
    /* Dark by default — this is exam software; light is opt-in via the toggle. */
    var mode = 'dark';
    function paint() {
      root.setAttribute('data-theme', mode);
      btn.setAttribute('aria-label', 'Switch to ' + (mode === 'dark' ? 'light' : 'dark') + ' mode');
      btn.innerHTML =
        mode === 'dark'
          ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
          : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
    paint();
    btn.addEventListener('click', function () {
      mode = mode === 'dark' ? 'light' : 'dark';
      paint();
    });
  })();

  /* ---------- timer ---------- */
  function startTimer(seconds) {
    stopTimer();
    state.total = seconds;
    state.deadline = Date.now() + seconds * 1000;
    timerEl.hidden = false;
    tick();
    state.timerId = setInterval(tick, 250);
  }
  function stopTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = null;
  }
  function tick() {
    var remaining = Math.max(0, (state.deadline - Date.now()) / 1000);
    state.remaining = remaining;
    var elapsed = state.total - remaining;
    timerValue.textContent = mmss(remaining);
    timerMeta.textContent = 'elapsed ' + mmss(elapsed) + ' / ' + mmss(state.total);
    timerFill.style.width = (state.total ? (remaining / state.total) * 100 : 0) + '%';
    timerEl.classList.toggle('is-warn', remaining < 300 && remaining >= 60);
    timerEl.classList.toggle('is-crit', remaining < 60);
    timerLabel.textContent = remaining < 60 ? 'Submitting soon' : 'Time remaining';
    if (remaining <= 0) {
      stopTimer();
      submitSection(true);
    }
  }
  function hideTimer() {
    stopTimer();
    timerEl.hidden = true;
    timerEl.classList.remove('is-warn', 'is-crit');
  }

  /* ---------- flow ---------- */
  function currentSectionId() {
    return state.queue[state.qidx];
  }

  function startRun(queue, mode) {
    var keep = { hint: {} };
    state = freshState();
    state.hint = keep.hint;
    state.queue = queue.slice();
    state.mode = mode;
    state.qidx = 0;
    beginSection();
  }

  function beginSection() {
    var id = currentSectionId();
    var meta = sectionMeta(id);
    state.screen = 'exam';
    state.cur = 0;
    state.reached = 0;
    startTimer(FAST !== null ? FAST : meta.minutes * 60);
    render();
  }

  function submitSection(auto) {
    if (state.screen !== 'exam') return;
    var id = currentSectionId();
    var meta = sectionMeta(id);
    var list = items(id);
    var ans = answersFor(id);
    var correct = 0;
    if (id !== 'workstyle' && id !== 'coding') {
      for (var i = 0; i < list.length; i++) {
        var key = id === 'worksim' ? list[i].best : list[i].answer;
        if (ans[i] === key) correct++;
      }
    }
    state.used[id] = Math.min(state.total, state.total - state.remaining);
    state.results[id] = {
      id: id,
      name: meta.name,
      scored: id !== 'workstyle' && id !== 'coding',
      correct: correct,
      total: list.length,
      answered: answeredCount(id),
      timeUsed: state.used[id],
      limit: state.total,
      auto: !!auto
    };
    hideTimer();
    state.screen = 'result';
    state.pending = null;
    render();
    announce(
      (auto ? 'Time expired. Section auto-submitted. ' : 'Section submitted. ') +
        meta.name +
        ' results are shown.'
    );
    window.scrollTo(0, 0);
  }

  function nextSection() {
    state.qidx++;
    if (state.qidx >= state.queue.length) {
      state.screen = 'summary';
      render();
      window.scrollTo(0, 0);
    } else {
      beginSection();
      window.scrollTo(0, 0);
    }
  }

  function toLanding() {
    hideTimer();
    var s = freshState();
    s.answers = state.answers;
    s.code = state.code;
    s.results = state.results;
    s.used = state.used;
    state = s;
    state.screen = 'landing';
    render();
  }

  function hardReset() {
    hideTimer();
    state = freshState();
    render();
    announce('Progress reset.');
  }

  /* ---------- render: landing ---------- */
  function renderLanding() {
    chip.hidden = true;
    var rows = SECTIONS.map(function (s) {
      return (
        '<tr><td><span class="s-name">' +
        esc(s.name) +
        '</span><span class="s-note">' +
        esc(s.note) +
        '</span></td><td><span class="s-mins">' +
        s.minutes +
        ' min</span></td></tr>'
      );
    }).join('');

    var starts = SECTIONS.map(function (s) {
      var done = state.results[s.id];
      return (
        '<button class="start-row" type="button" data-start="' +
        s.id +
        '"><span><span class="start-row__name">' +
        esc(s.name) +
        '</span><br><span class="start-row__meta">' +
        items(s.id).length +
        ' items · ' +
        s.minutes +
        ' min' +
        (done ? ' · attempted' : '') +
        '</span></span><span class="start-row__meta">Start &rarr;</span></button>'
      );
    }).join('');

    main.innerHTML =
      '<section class="hero fade-in">' +
      '<p class="eyebrow">Timed mock assessment</p>' +
      '<h1>' +
      esc(DATA.meta.title) +
      '</h1>' +
      '<p>' +
      esc(DATA.meta.subtitle) +
      '. Six sections, strict per-section timers, no revisiting a section once it is submitted — exactly how the real assessment behaves. Sit it in one uninterrupted block if you can.</p>' +
      '<div class="hero__stats">' +
      '<div class="stat"><div class="stat__value">' +
      TOTAL_MIN +
      ' min</div><div class="stat__label">Full mock</div></div>' +
      '<div class="stat"><div class="stat__value">' +
      SECTIONS.length +
      '</div><div class="stat__label">Sections</div></div>' +
      '<div class="stat"><div class="stat__value">' +
      SECTIONS.reduce(function (a, s) {
        return a + items(s.id).length;
      }, 0) +
      '</div><div class="stat__label">Items</div></div>' +
      '</div></section>' +
      '<div class="section-grid">' +
      '<div class="panel"><h2 class="panel__title">Structure</h2>' +
      '<p class="panel__note">Sections run in this order in the full mock.</p>' +
      '<table class="sections-table"><thead><tr><th scope="col">Section</th><th scope="col">Duration</th></tr></thead><tbody>' +
      rows +
      '</tbody><tfoot><tr><td>Total</td><td>' +
      TOTAL_MIN +
      ' min</td></tr></tfoot></table></div>' +
      '<div>' +
      '<div class="panel"><h2 class="panel__title">Begin</h2>' +
      '<p class="panel__note">The timer starts the moment a section opens.</p>' +
      '<button class="btn btn--primary btn--block" type="button" id="start-full">Full mock (all sections in order)</button>' +
      '<span class="field-label">Or practise one section</span>' +
      '<div class="start-list">' +
      starts +
      '</div></div>' +
      '</div></div>' +
      '<div class="callout"><strong>Rules enforced here, as in the real OA</strong>' +
      '<ul>' +
      '<li>Timers are strict. At zero the section submits itself with whatever you have.</li>' +
      '<li>A submitted section cannot be reopened or revisited.</li>' +
      '<li>Logical Reasoning is one-way: once you advance, that question is closed.</li>' +
      '<li>Coding model solutions stay locked until you submit the section.</li>' +
      '<li>Workstyles is not scored — it is read for consistency across the whole set.</li>' +
      '</ul></div>';

    document.getElementById('start-full').addEventListener('click', function () {
      startRun(
        SECTIONS.map(function (s) {
          return s.id;
        }),
        'full'
      );
      window.scrollTo(0, 0);
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-start]'), function (b) {
      b.addEventListener('click', function () {
        startRun([b.getAttribute('data-start')], 'single');
        window.scrollTo(0, 0);
      });
    });
  }

  /* ---------- render: exam ---------- */
  var FREE_NAV = { debug: 1, corecs: 1, worksim: 1, workstyle: 1, coding: 1 };
  var PALETTE = { corecs: 1, debug: 1, worksim: 1, workstyle: 1 };

  function renderExam() {
    var id = currentSectionId();
    var meta = sectionMeta(id);
    var list = items(id);
    var n = list.length;
    var i = Math.min(state.cur, n - 1);
    state.cur = i;
    if (i > state.reached) state.reached = i;

    chip.hidden = false;
    chip.textContent =
      meta.name + ' · Q' + (i + 1) + '/' + n + (state.mode === 'full' ? ' · full mock' : '');

    var body = '';
    if (id === 'coding') body = codingBody(list[i], i, n);
    else if (id === 'workstyle') body = workstyleBody(list[i], i, n);
    else if (id === 'debug') body = debugBody(list[i], i, n);
    else body = mcqBody(list[i], i, n, id);

    var pct = (answeredCount(id) / n) * 100;
    var head =
      '<section class="exam-head">' +
      '<div><p class="eyebrow">' +
      (state.mode === 'full'
        ? 'Section ' + (state.qidx + 1) + ' of ' + state.queue.length
        : 'Single section') +
      '</p><h1>' +
      esc(meta.name) +
      '</h1></div>' +
      '<p class="exam-head__meta">' +
      esc(meta.note) +
      ' · ' +
      answeredCount(id) +
      '/' +
      n +
      ' recorded</p>' +
      '</section><div class="progress-bar"><div class="progress-bar__fill" style="width:' +
      pct +
      '%"></div></div>';

    var palette = PALETTE[id] ? paletteHtml(id, i, n) : '';
    main.innerHTML =
      head +
      '<div class="qwrap' +
      (palette ? ' qwrap--palette' : '') +
      '"><div class="qcard fade-in">' +
      body +
      navHtml(id, i, n) +
      '</div>' +
      palette +
      '</div>';

    wireExam(id, i, n);
  }

  function debugBody(q, i, n) {
    return (
      '<p class="qcard__num">Question ' +
      (i + 1) +
      ' / ' +
      n +
      '</p>' +
      '<h2 class="qcard__prompt">' +
      md(q.prompt) +
      '</h2>' +
      codeLines(q.code) +
      optionsHtml(q.options, i, 'debug')
    );
  }

  function mcqBody(q, i, n, id) {
    var topic = q.topic
      ? '<div class="badge-row"><span class="badge badge--accent">' + esc(q.topic) + '</span></div>'
      : '';
    var text = id === 'worksim' ? q.scenario : q.q;
    var oneWay =
      id === 'reasoning'
        ? '<div class="badge-row"><span class="badge">one-way · no going back</span></div>'
        : '';
    return (
      '<p class="qcard__num">Question ' +
      (i + 1) +
      ' / ' +
      n +
      '</p>' +
      topic +
      oneWay +
      (id === 'worksim'
        ? '<h2 class="qcard__prompt">Scenario</h2><p class="qcard__scenario">' +
          md(text) +
          '</p><p class="field-label" style="margin-top:0">What do you do?</p>'
        : '<h2 class="qcard__prompt">' + md(text) + '</h2>') +
      optionsHtml(q.options, i, id)
    );
  }

  function optionsHtml(options, qi, id) {
    var sel = answersFor(id)[qi];
    var opts = options
      .map(function (o, k) {
        return (
          '<button class="opt' +
          (sel === k ? ' is-selected' : '') +
          '" type="button" role="radio" aria-checked="' +
          (sel === k ? 'true' : 'false') +
          '" data-opt="' +
          k +
          '"><span class="opt__key" aria-hidden="true">' +
          (k + 1) +
          '</span><span class="opt__text">' +
          md(o) +
          '</span></button>'
        );
      })
      .join('');
    return (
      '<div class="options" role="radiogroup" aria-label="Answer options for question ' +
      (qi + 1) +
      '">' +
      opts +
      '</div>'
    );
  }

  function workstyleBody(q, i, n) {
    var sel = answersFor('workstyle')[i];
    function card(side, txt) {
      return (
        '<button class="pair__card' +
        (sel === side ? ' is-selected' : '') +
        '" type="button" role="radio" aria-checked="' +
        (sel === side ? 'true' : 'false') +
        '" data-side="' +
        side +
        '"><span class="pair__tag">' +
        (side === 'a' ? '1 · Statement A' : '2 · Statement B') +
        '</span><span class="pair__stmt">' +
        md(txt) +
        '</span><span class="badge">' +
        (sel === side ? 'selected' : 'choose this') +
        '</span></button>'
      );
    }
    return (
      '<p class="qcard__num">Pair ' +
      (i + 1) +
      ' / ' +
      n +
      '</p>' +
      '<h2 class="qcard__prompt">Which statement describes you better?</h2>' +
      '<p class="qcard__scenario">There is no correct answer. Answer as you actually work — Amazon reads the whole set for consistency.</p>' +
      '<div class="pair">' +
      card('a', q.a) +
      card('b', q.b) +
      '</div>'
    );
  }

  function codingBody(q, i, n) {
    var val = state.code[q.id] || '';
    var open = !!state.hint[q.id];
    return (
      '<p class="qcard__num">Problem ' +
      (i + 1) +
      ' / ' +
      n +
      '</p>' +
      '<h2 class="qcard__prompt">' +
      esc(q.title) +
      '</h2>' +
      '<div class="badge-row"><span class="badge badge--accent">' +
      esc(q.difficulty) +
      '</span><span class="badge">suggested ' +
      q.suggested +
      ' min</span><span class="badge">' +
      esc(q.source) +
      '</span></div>' +
      '<div class="statement">' +
      esc(q.statement) +
      '</div>' +
      '<label class="field-label" for="editor">Your approach and code</label>' +
      '<textarea class="editor" id="editor" spellcheck="false" placeholder="1. Restate the problem.\n2. Approach and why it is correct.\n3. Complexity.\n4. Code.">' +
      esc(val) +
      '</textarea>' +
      '<div class="tool-row">' +
      '<button class="btn btn--outline btn--sm" type="button" id="hint-btn" aria-expanded="' +
      (open ? 'true' : 'false') +
      '" aria-controls="hint-box">' +
      (open ? 'Hide hint' : 'Show hint') +
      '</button>' +
      '<button class="btn btn--outline btn--sm" type="button" disabled title="Unlocks after you submit this section">Reveal model solution (locked)</button>' +
      '<span class="saved-note" id="saved-note">autosaved · ' +
      val.length +
      ' chars</span>' +
      '</div>' +
      (open ? '<div class="hint-box" id="hint-box"><strong>Hint.</strong> ' + md(q.hint) + '</div>' : '')
    );
  }

  function paletteHtml(id, cur, n) {
    var ans = answersFor(id);
    var btns = '';
    for (var k = 0; k < n; k++) {
      var done = ans[k] !== null && ans[k] !== undefined;
      btns +=
        '<button class="pbtn' +
        (done ? ' is-answered' : '') +
        (k === cur ? ' is-current' : '') +
        '" type="button" data-goto="' +
        k +
        '" aria-label="Question ' +
        (k + 1) +
        (done ? ', answered' : ', unanswered') +
        '"' +
        (k === cur ? ' aria-current="true"' : '') +
        '>' +
        (k + 1) +
        '</button>';
    }
    return (
      '<aside class="palette" aria-label="Question palette"><p class="palette__title">Questions</p>' +
      '<div class="palette__grid">' +
      btns +
      '</div><div class="palette__legend">' +
      '<span class="legend-row"><span class="legend-dot legend-dot--ans"></span>answered</span>' +
      '<span class="legend-row"><span class="legend-dot"></span>not answered</span>' +
      '<span class="legend-row"><span class="legend-dot legend-dot--cur"></span>current</span>' +
      '</div></aside>'
    );
  }

  function navHtml(id, i, n) {
    var free = !!FREE_NAV[id];
    var prev =
      free && i > 0
        ? '<button class="btn btn--outline" type="button" id="prev-btn">&larr; Previous</button>'
        : '';
    var next =
      i < n - 1
        ? '<button class="btn btn--primary" type="button" id="next-btn">Next &rarr;</button>'
        : '';
    var submit =
      '<button class="btn ' +
      (i === n - 1 ? 'btn--primary' : 'btn--danger') +
      '" type="button" id="submit-btn">Submit section</button>';
    return (
      '<div class="navbar">' +
      prev +
      next +
      '<span class="navbar__spacer"></span>' +
      submit +
      '<p class="navbar__hint">Keys: ' +
      (id === 'workstyle'
        ? '1 / 2 pick a statement'
        : id === 'coding'
          ? 'type freely in the editor'
          : '1–4 select an option') +
      (id === 'coding' ? ' · &rarr; next problem' : ' · Enter or &rarr; next') +
      (free && i > 0 ? ' · &larr; previous' : '') +
      (id === 'reasoning' ? ' · answers close when you advance' : '') +
      '</p></div>'
    );
  }

  function wireExam(id, i, n) {
    Array.prototype.forEach.call(main.querySelectorAll('[data-opt]'), function (b) {
      b.addEventListener('click', function () {
        select(id, i, parseInt(b.getAttribute('data-opt'), 10));
      });
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-side]'), function (b) {
      b.addEventListener('click', function () {
        select(id, i, b.getAttribute('data-side'));
      });
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-goto]'), function (b) {
      b.addEventListener('click', function () {
        state.cur = parseInt(b.getAttribute('data-goto'), 10);
        render();
      });
    });
    var prev = document.getElementById('prev-btn');
    if (prev) prev.addEventListener('click', goPrev);
    var next = document.getElementById('next-btn');
    if (next) next.addEventListener('click', goNext);
    document.getElementById('submit-btn').addEventListener('click', function () {
      confirmSubmit(id);
    });

    var ed = document.getElementById('editor');
    if (ed) {
      var q = items('coding')[i];
      ed.addEventListener('input', function () {
        state.code[q.id] = ed.value;
        var note = document.getElementById('saved-note');
        if (note) note.textContent = 'autosaved · ' + ed.value.length + ' chars';
      });
      var hb = document.getElementById('hint-btn');
      hb.addEventListener('click', function () {
        state.hint[q.id] = !state.hint[q.id];
        render();
      });
    }
  }

  function select(id, i, value) {
    answersFor(id)[i] = value;
    render();
  }
  function goNext() {
    var id = currentSectionId();
    if (state.cur < items(id).length - 1) {
      state.cur++;
      render();
      window.scrollTo(0, 0);
    }
  }
  function goPrev() {
    var id = currentSectionId();
    if (FREE_NAV[id] && state.cur > 0) {
      state.cur--;
      render();
      window.scrollTo(0, 0);
    }
  }

  function confirmSubmit(id) {
    var n = items(id).length;
    var left = n - answeredCount(id);
    openModal(
      'Submit ' + sectionMeta(id).name + '?',
      (left > 0
        ? left + ' of ' + n + ' items are unanswered. '
        : 'All ' + n + ' items are recorded. ') +
        'You cannot reopen this section afterwards.',
      'Submit section',
      function () {
        submitSection(false);
      }
    );
  }

  function openModal(title, text, confirmLabel, onConfirm) {
    var wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">' +
      esc(title) +
      '</h2><p>' +
      esc(text) +
      '</p><div class="action-row"><button class="btn btn--primary" type="button" id="modal-ok">' +
      esc(confirmLabel) +
      '</button><button class="btn btn--ghost" type="button" id="modal-cancel">Cancel</button></div></div>';
    document.body.appendChild(wrap);
    var ok = wrap.querySelector('#modal-ok');
    ok.focus();
    function close() {
      wrap.remove();
    }
    ok.addEventListener('click', function () {
      close();
      onConfirm();
    });
    wrap.querySelector('#modal-cancel').addEventListener('click', close);
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) close();
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  /* ---------- render: section results ---------- */
  function renderResult() {
    var id = currentSectionId();
    var r = state.results[id];
    chip.hidden = false;
    chip.textContent = r.name + ' · submitted';

    var head =
      '<section class="exam-head"><div><p class="eyebrow">' +
      (r.auto ? 'Time expired — auto-submitted' : 'Section submitted') +
      '</p><h1>' +
      esc(r.name) +
      ' — results</h1></div><p class="exam-head__meta">' +
      mmss(r.timeUsed) +
      ' used of ' +
      mmss(r.limit) +
      '</p></section>';

    var strip;
    if (r.scored) {
      var pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      strip =
        '<div class="score-strip">' +
        cell('Score', r.correct + ' / ' + r.total, true) +
        cell('Percentage', pct + '%') +
        cell('Answered', r.answered + ' / ' + r.total) +
        cell('Time used', mmss(r.timeUsed)) +
        '</div>';
    } else if (id === 'coding') {
      strip =
        '<div class="score-strip">' +
        cell('Problems attempted', r.attemptedCoding !== undefined ? r.attemptedCoding : codingAttempted() + ' / ' + r.total, true) +
        cell('Scoring', 'self-assess') +
        cell('Time used', mmss(r.timeUsed)) +
        '</div>';
    } else {
      strip =
        '<div class="score-strip">' +
        cell('Pairs answered', r.answered + ' / ' + r.total, true) +
        cell('Scoring', 'not scored') +
        cell('Time used', mmss(r.timeUsed)) +
        '</div>';
    }

    var body;
    if (id === 'coding') body = codingReview();
    else if (id === 'workstyle') body = workstyleReadout();
    else body = mcqReview(id);

    var actions =
      '<div class="action-row">' +
      (state.mode === 'full'
        ? '<button class="btn btn--primary" type="button" id="cont-btn">' +
          (state.qidx < state.queue.length - 1
            ? 'Start next section: ' + esc(sectionMeta(state.queue[state.qidx + 1]).name)
            : 'View full mock summary') +
          '</button>'
        : '') +
      '<button class="btn btn--outline" type="button" id="home-btn">Back to sections</button>' +
      '</div>';

    main.innerHTML = head + strip + body + actions;
    var c = document.getElementById('cont-btn');
    if (c)
      c.addEventListener('click', function () {
        nextSection();
      });
    document.getElementById('home-btn').addEventListener('click', toLanding);
  }

  function cell(label, value, accent) {
    return (
      '<div class="score-cell' +
      (accent ? ' score-cell--accent' : '') +
      '"><p class="score-cell__label">' +
      esc(label) +
      '</p><p class="score-cell__value">' +
      esc(value) +
      '</p></div>'
    );
  }

  function codingAttempted() {
    return items('coding').filter(function (q) {
      return (state.code[q.id] || '').trim().length > 0;
    }).length;
  }

  function mcqReview(id) {
    var list = items(id);
    var ans = answersFor(id);
    var html =
      '<h2 class="panel__title">Review</h2><p class="panel__note">Every item, your answer, the correct answer and why.</p><div class="review">';
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      var key = id === 'worksim' ? q.best : q.answer;
      var mine = ans[i];
      var ok = mine === key;
      var text = id === 'worksim' ? q.scenario : q.q;
      html +=
        '<article class="review__item ' +
        (ok ? 'is-correct' : 'is-wrong') +
        '"><div class="review__head"><span class="badge">Q' +
        (i + 1) +
        (q.topic ? ' · ' + esc(q.topic) : '') +
        '</span><span class="badge ' +
        (ok ? 'badge--ok">correct' : 'badge--bad">' + (mine === null || mine === undefined ? 'not answered' : 'incorrect')) +
        '</span></div>' +
        '<p class="review__q">' +
        md(text) +
        '</p>' +
        (id === 'debug' ? codeLines(q.code) : '') +
        '<div class="review__row"><span class="review__key">Your answer</span><span class="review__val ' +
        (ok ? 'ok' : 'bad') +
        '">' +
        (mine === null || mine === undefined
          ? '— none —'
          : letter(mine) + '. ' + md(q.options[mine])) +
        '</span></div>' +
        '<div class="review__row"><span class="review__key">' +
        (id === 'worksim' ? 'Best answer' : 'Correct') +
        '</span><span class="review__val ok">' +
        letter(key) +
        '. ' +
        md(q.options[key]) +
        '</span></div>' +
        '<p class="explain">' +
        md(q.explain) +
        '</p></article>';
    }
    return html + '</div>';
  }

  function codingReview() {
    var list = items('coding');
    var html =
      '<h2 class="panel__title">Self-assessment</h2><p class="panel__note">Amazon graders read correctness, complexity and clarity. Compare your write-up against the model approach line by line and mark yourself honestly.</p><div class="review">';
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      var mine = (state.code[q.id] || '').trim();
      html +=
        '<article class="review__item"><div class="review__head"><span class="badge badge--accent">' +
        esc(q.title) +
        '</span><span class="badge">' +
        esc(q.difficulty) +
        ' · self-assess</span></div>' +
        '<div class="split">' +
        '<div><span class="field-label" style="margin-top:0">Your submission</span><pre class="plain">' +
        (mine ? esc(mine) : 'Nothing submitted for this problem.') +
        '</pre></div>' +
        '<div><span class="field-label" style="margin-top:0">Model approach</span><p style="font-size:var(--text-sm)">' +
        md(q.approach) +
        '</p><span class="field-label">Complexity</span><p style="font-size:var(--text-sm)"><code class="inline">' +
        esc(q.complexity) +
        '</code></p></div>' +
        '</div>' +
        '<span class="field-label">Model solution</span><pre class="plain">' +
        esc(q.solution) +
        '</pre>' +
        '<p class="explain"><strong>Hint you had available:</strong> ' +
        md(q.hint) +
        '</p></article>';
    }
    return html + '</div>';
  }

  function workstyleReadout() {
    var list = items('workstyle');
    var ans = answersFor('workstyle');
    var counts = {},
      totals = {},
      byLp = {};
    function track(lp, i, side) {
      byLp[lp] = byLp[lp] || [];
      byLp[lp].push({ i: i, side: side, matched: ans[i] === side });
    }
    for (var i = 0; i < list.length; i++) {
      var m = WORKSTYLE_MAP[i];
      totals[m.a.lp] = (totals[m.a.lp] || 0) + 1;
      totals[m.b.lp] = (totals[m.b.lp] || 0) + 1;
      counts[m.a.lp] = (counts[m.a.lp] || 0) + (ans[i] === 'a' ? 1 : 0);
      counts[m.b.lp] = (counts[m.b.lp] || 0) + (ans[i] === 'b' ? 1 : 0);
      track(m.a.lp, i, 'a');
      track(m.b.lp, i, 'b');
    }
    var rows = LP_ORDER.filter(function (lp) {
      return totals[lp];
    })
      .map(function (lp) {
        var c = counts[lp],
          t = totals[lp];
        return (
          '<div class="lp-row"><span class="lp-name">' +
          esc(lp) +
          '</span><span class="lp-track"><span class="lp-fill" style="width:' +
          (t ? (c / t) * 100 : 0) +
          '%"></span></span><span class="lp-count">' +
          c +
          '/' +
          t +
          ' leaning</span></div>'
        );
      })
      .join('');

    var detail = list
      .map(function (q, i) {
        var m = WORKSTYLE_MAP[i];
        var picked = ans[i];
        var pickedLp = picked === 'a' ? m.a.lp : picked === 'b' ? m.b.lp : null;
        return (
          '<article class="review__item"><div class="review__head"><span class="badge">Pair ' +
          (i + 1) +
          '</span><span class="badge' +
          (pickedLp ? ' badge--accent">' + esc(pickedLp) : '">not answered') +
          '</span></div>' +
          '<div class="review__row"><span class="review__key">Statement A</span><span class="review__val' +
          (picked === 'a' ? ' ok' : '') +
          '">' +
          md(q.a) +
          ' <em>(' +
          esc(m.a.lp) +
          ')</em></span></div>' +
          '<div class="review__row"><span class="review__key">Statement B</span><span class="review__val' +
          (picked === 'b' ? ' ok' : '') +
          '">' +
          md(q.b) +
          ' <em>(' +
          esc(m.b.lp) +
          ')</em></span></div>' +
          '<p class="explain">Both statements are genuine leadership behaviors — Statement A reads as <strong>' +
          esc(m.a.lp) +
          '</strong> (' +
          esc(m.a.tag) +
          '), Statement B reads as <strong>' +
          esc(m.b.lp) +
          '</strong> (' +
          esc(m.b.tag) +
          '). Neither side is wrong; what matters is whether your answers across all twelve pairs tell one coherent story.</p></article>'
        );
      })
      .join('');

    return (
      '<div class="panel"><h2 class="panel__title">Leadership Principle leanings</h2>' +
      '<p class="panel__note">Derived from which side of each pair you picked. This is a directional read-out, not a score.</p>' +
      '<div class="lp-list">' +
      rows +
      '</div></div>' +
      '<div class="callout"><strong>What Amazon actually measures.</strong> Workstyles is not marked right or wrong. It is checked for internal consistency: the same trait is probed from several angles, and contradictory answers stand out far more than any single "wrong" choice. Do not try to guess the answer Amazon wants — answer as the engineer you actually are, and be ready to defend every leaning with a real story in the interview.</div>' +
      '<h2 class="panel__title" style="margin-top:var(--space-10)">Your choices</h2><div class="review">' +
      detail +
      '</div>' +
      barRaiserAudit(byLp)
    );
  }

  /* Bar-Raiser-style read of the finished profile.
     Deliberately does NOT tell the candidate which statement to pick — Workstyles
     has no correct answer, and a uniform "impressive" profile is itself a red flag
     to a trained interviewer. Instead this names, per principle, how confidently
     the pattern reads and what story to have ready, so prep effort goes into
     rehearsing real examples rather than reverse-engineering the instrument. */
  function barRaiserAudit(byLp) {
    var strong = [],
      split = [],
      single = [],
      away = [];

    LP_ORDER.forEach(function (lp) {
      var entries = byLp[lp];
      if (!entries || !entries.length) return;
      var t = entries.length;
      var c = entries.filter(function (e) {
        return e.matched;
      }).length;
      var pairs = entries
        .map(function (e) {
          return e.i + 1;
        })
        .join(', ');
      var ratio = c / t;
      var row = { lp: lp, c: c, t: t, pairs: pairs, ratio: ratio };
      if (t === 1) single.push(row);
      else if (ratio >= 0.75) strong.push(row);
      else if (ratio <= 0.25) away.push(row);
      else split.push(row);
    });

    function li(row, kind) {
      var head = '<strong>' + esc(row.lp) + '</strong> (' + row.c + '/' + row.t + ', Pair' + (row.t > 1 ? 's ' : ' ') + row.pairs + ')';
      var body;
      if (kind === 'strong') {
        body =
          'a repeated, consistent lean. Expect this to be the principle a Bar Raiser digs into hardest — have two distinct, specific stories ready, not one polished one. A strong lean with a weak or generic example under questioning reads worse than a mixed profile.';
      } else if (kind === 'away') {
        body =
          'a repeated lean toward the other statement in every pair that touches it. That is a legitimate working style, not a defect — but if the role you are interviewing for leans on this principle, be ready to name one real time you did show it, even if it is not your default.';
      } else if (kind === 'split') {
        body =
          'a mixed signal — you leaned each way at least once. Normal; few engineers are 100% consistent on any single trait. The thing to prepare for specifically is the pair where you leaned "against type" — a Bar Raiser who notices the split may ask about that exact pair, and an honest, specific answer lands far better than backpedaling toward the majority side.';
      } else {
        body =
          'only one pair in this set probes it, so there is nothing to cross-check it against. Treat it as low-confidence signal — worth having one story ready, but do not over-read a single data point either way.';
      }
      return '<li>' + head + ' — ' + body + '</li>';
    }

    var items =
      strong.map(function (r) { return li(r, 'strong'); }).join('') +
      split.map(function (r) { return li(r, 'split'); }).join('') +
      away.map(function (r) { return li(r, 'away'); }).join('') +
      single.map(function (r) { return li(r, 'single'); }).join('');

    return (
      '<h2 class="panel__title" style="margin-top:var(--space-10)">Bar-Raiser read: what this profile signals</h2>' +
      '<div class="callout">This section will not tell you which statement to pick — there is no scored "right" answer here, and a uniformly impressive-looking profile is itself something a trained interviewer is taught to be skeptical of. What follows is an honest read of the pattern you actually produced, and what to have ready if it gets probed in the loop.</div>' +
      '<ul class="review" style="padding-left:1.1em;list-style:disc">' +
      items +
      '</ul>' +
      '<p class="explain" style="margin-top:var(--space-4)">Impact on the interviewer: Workstyles itself carries no numeric score, but Bar Raisers and hiring managers typically skim this read-out before the onsite loop and use it to pick which behavioral questions to ask — your strongest leans get the deepest follow-up, and any split gets a direct "tell me about a time you went the other way." The determining factor is never which side you picked; it is whether your answer in the room matches the pattern you produced here.</p>'
    );
  }

  /* ---------- render: final summary ---------- */
  function renderSummary() {
    hideTimer();
    chip.hidden = false;
    chip.textContent = 'Full mock complete';

    var scoredCorrect = 0,
      scoredTotal = 0,
      timeTotal = 0;
    var rows = state.queue
      .map(function (id) {
        var r = state.results[id];
        if (!r) return '';
        timeTotal += r.timeUsed;
        var scoreTxt;
        if (r.scored) {
          scoredCorrect += r.correct;
          scoredTotal += r.total;
          scoreTxt = r.correct + ' / ' + r.total;
        } else if (id === 'coding') {
          scoreTxt = codingAttempted() + ' / ' + r.total + ' attempted';
        } else {
          scoreTxt = r.answered + ' / ' + r.total + ' answered';
        }
        var pct = r.scored ? Math.round((r.correct / r.total) * 100) + '%' : '—';
        return (
          '<tr><td>' +
          esc(r.name) +
          (r.auto ? ' <span class="badge badge--bad">auto-submitted</span>' : '') +
          '</td><td>' +
          scoreTxt +
          '</td><td>' +
          pct +
          '</td><td>' +
          mmss(r.timeUsed) +
          '</td></tr>'
        );
      })
      .join('');

    var pctAll = scoredTotal ? Math.round((scoredCorrect / scoredTotal) * 100) : 0;

    main.innerHTML =
      '<section class="hero fade-in"><p class="eyebrow">Full mock complete</p><h1>Your calibration report</h1>' +
      '<p>MCQ sections are objective and scored below. Coding and Workstyles are deliberately not scored here — read the guidance before you draw conclusions.</p></section>' +
      '<div class="score-strip">' +
      cell('MCQ total', scoredCorrect + ' / ' + scoredTotal, true) +
      cell('MCQ percentage', pctAll + '%') +
      cell('Coding attempted', codingAttempted() + ' / ' + items('coding').length) +
      cell('Total time used', mmss(timeTotal)) +
      '</div>' +
      '<div class="panel"><h2 class="panel__title">Per section</h2><table class="summary-table"><thead><tr><th scope="col">Section</th><th scope="col">Result</th><th scope="col">%</th><th scope="col">Time</th></tr></thead><tbody>' +
      rows +
      '</tbody><tfoot><tr><td>Scored MCQ subtotal</td><td>' +
      scoredCorrect +
      ' / ' +
      scoredTotal +
      '</td><td>' +
      pctAll +
      '%</td><td>' +
      mmss(timeTotal) +
      '</td></tr></tfoot></table></div>' +
      '<div class="callout"><strong>Honest calibration.</strong>' +
      '<ul>' +
      '<li><strong>The two coding problems decide the outcome.</strong> Amazon weights the coding assessment far above everything else. A clean, fully working solution with correct complexity on both problems is what moves you forward.</li>' +
      '<li><strong>A strong MCQ score does not compensate for weak coding.</strong> Core CS, reasoning and debugging screen out; they do not pull you up. ' +
      pctAll +
      '% on MCQs with one broken coding solution is a weaker profile than an average MCQ score with two solid ones.</li>' +
      '<li><strong>Judge your coding answers against the model approach, not against your memory of feeling confident.</strong> If you did not state a complexity, you did not finish the answer.</li>' +
      '<li><strong>Workstyles is unscored on purpose.</strong> Consistency across the full set is the signal — gaming individual pairs is visible.</li>' +
      '<li><strong>Time is part of the test.</strong> ' +
      mmss(timeTotal) +
      ' of ' +
      TOTAL_MIN +
      ' minutes used. Sections you auto-submitted are flagged above; those are pacing failures to fix before the real sitting.</li>' +
      '</ul></div>' +
      '<div class="action-row"><button class="btn btn--primary" type="button" id="again-btn">Reset and sit it again</button>' +
      '<button class="btn btn--outline" type="button" id="home-btn">Back to sections</button></div>';

    document.getElementById('again-btn').addEventListener('click', hardReset);
    document.getElementById('home-btn').addEventListener('click', toLanding);
  }

  /* ---------- router ---------- */
  function render() {
    if (state.screen === 'landing') renderLanding();
    else if (state.screen === 'exam') renderExam();
    else if (state.screen === 'result') renderResult();
    else renderSummary();
  }

  /* ---------- global controls ---------- */
  document.getElementById('reset-btn').addEventListener('click', function () {
    openModal(
      'Reset everything?',
      'All answers, code and results are held in memory only and will be cleared immediately.',
      'Reset',
      hardReset
    );
  });

  document.addEventListener('keydown', function (e) {
    if (document.querySelector('.modal-backdrop')) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;
    if (state.screen !== 'exam') return;
    var id = currentSectionId();
    var n = items(id).length;
    var i = state.cur;

    if (e.key >= '1' && e.key <= '9') {
      var k = parseInt(e.key, 10) - 1;
      if (id === 'workstyle') {
        if (k < 2) {
          e.preventDefault();
          select(id, i, k === 0 ? 'a' : 'b');
        }
        return;
      }
      if (id === 'coding') return;
      var q = items(id)[i];
      if (k < q.options.length) {
        e.preventDefault();
        select(id, i, k);
      }
      return;
    }
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      if (id === 'coding' && e.key === 'Enter') return;
      e.preventDefault();
      if (i < n - 1) goNext();
      else confirmSubmit(id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    }
  });

  render();
})();