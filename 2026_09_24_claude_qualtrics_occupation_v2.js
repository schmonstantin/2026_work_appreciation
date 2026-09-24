/* ------------------------------------------------------------------
   Occupation lookup for Qualtrics - WISCO / ISCO-08
   VERSION 2: mobile-safe (touch selection, no clipping, keyboard-aware)

   Attach to a single-line TEXT ENTRY question
   (gear icon > Add JavaScript). Delete the three empty stubs first.

   Requires, in Survey Flow ABOVE the question block, an Embedded Data
   element declaring (values left empty):
       isco_label  isco08  isco_isei  isco_skill  isco_source  isco_ncand

   Put a PAGE BREAK straight after this question, or piped values
   (${e://Field/isco_label}) will render empty.

   What changed from v1, and why:
   - pointerdown instead of mousedown: one event for mouse and touch.
     On iOS the synthetic mousedown can arrive after blur has already
     closed the list, so taps did nothing.
   - the input is wrapped in its own position:relative container, and
     overflow:hidden is cleared on ancestors, so the list is not clipped
     by Qualtrics' mobile layout.
   - a picking flag guards the blur race.
   - max-height capped in vh and the list scrolled into view, so the
     on-screen keyboard does not cover the suggestions.
   - autocapitalize / autocorrect off: phone keyboards otherwise capitalise
     and "helpfully" rewrite what is typed.
------------------------------------------------------------------- */

Qualtrics.SurveyEngine.addOnReady(function () {
  var DICT_URL  = "https://schmonstantin.github.io/2026_work_appreciation/2026_09_24_claude_wisco_en_gb.json";
  var MAX_SHOWN = 8;
  var NOMATCH_TEXT = "My job is not in this list";

  var container = this.getQuestionContainer();
  var input = container.querySelector("input[type=text]");
  if (!input) { return; }

  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");

  /* --- 1. give the dropdown a positioned parent of its own ---------- */
  var anchor = document.createElement("div");
  anchor.style.cssText = "position:relative;width:100%;";
  input.parentNode.insertBefore(anchor, input);
  anchor.appendChild(input);

  /* --- 2. stop ancestors from clipping it -------------------------- */
  var node = anchor.parentNode, depth = 0;
  while (node && node !== document.body && depth < 8) {
    var cs = window.getComputedStyle(node);
    if (cs.overflow !== "visible" || cs.overflowY !== "visible") {
      node.style.overflow = "visible";
      node.style.overflowY = "visible";
    }
    node = node.parentNode; depth++;
  }

  var box = document.createElement("div");
  box.setAttribute("role", "listbox");
  box.style.cssText =
    "position:absolute;left:0;right:0;top:100%;z-index:9999;" +
    "background:#fff;border:1px solid #bbb;border-top:none;" +
    "max-height:40vh;overflow-y:auto;-webkit-overflow-scrolling:touch;" +
    "display:none;text-align:left;box-shadow:0 6px 18px rgba(0,0,0,.14);";
  anchor.appendChild(box);

  var dict = [];
  var picking = false;   /* true between pointerdown and the pick completing */

  function norm(s) {
    return String(s).toLowerCase()
      .replace(/\u00e4/g, "ae").replace(/\u00f6/g, "oe")
      .replace(/\u00fc/g, "ue").replace(/\u00df/g, "ss")
      .replace(/[\/\-]/g, "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  fetch(DICT_URL)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      dict = d.map(function (e) {
        return { l: e.l, i: e.i, e: e.e, s: e.s, n: norm(e.l) };
      });
    })
    .catch(function () { /* dictionary unavailable: free text still works */ });

  function search(q) {
    var toks = norm(q).split(" ").filter(Boolean);
    if (!toks.length || !dict.length) { return []; }
    var starts = [], contains = [];
    for (var k = 0; k < dict.length; k++) {
      var n = dict[k].n, ok = true;
      for (var t = 0; t < toks.length; t++) {
        if (n.indexOf(toks[t]) === -1) { ok = false; break; }
      }
      if (!ok) { continue; }
      if (n.indexOf(toks[0]) === 0) { starts.push(dict[k]); }
      else { contains.push(dict[k]); }
    }
    return starts.concat(contains);
  }

  function setED(k, v) { Qualtrics.SurveyEngine.setEmbeddedData(k, v); }

  function clearCode() {
    setED("isco08", "");
    setED("isco_label", "");
    setED("isco_isei", "");
    setED("isco_skill", "");
  }

  function hide() { box.style.display = "none"; }

  function choose(item) {
    input.value = item.l;
    setED("isco_label", item.l);
    setED("isco08", item.i);
    setED("isco_isei", String(item.e));
    setED("isco_skill", String(item.s));
    setED("isco_source", "lookup");
    hide();
    input.blur();               /* dismisses the phone keyboard */
  }

  /* One handler for mouse, touch and pen. preventDefault on pointerdown
     stops the input losing focus, which is what broke selection on iOS. */
  function bindPick(el, fn) {
    el.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      picking = true;
      fn();
      picking = false;
    });
    /* fallback for any browser without pointer events */
    if (!window.PointerEvent) {
      el.addEventListener("touchstart", function (ev) {
        ev.preventDefault(); picking = true; fn(); picking = false;
      }, { passive: false });
      el.addEventListener("mousedown", function (ev) {
        ev.preventDefault(); picking = true; fn(); picking = false;
      });
    }
  }

  function row(text, italic, onPick) {
    var d = document.createElement("div");
    d.textContent = text;
    d.setAttribute("role", "option");
    /* 44px min-height is the usual minimum comfortable tap target */
    d.style.cssText = "padding:12px 12px;min-height:44px;cursor:pointer;" +
      "line-height:1.35;border-bottom:1px solid #f0f0f0;" +
      (italic ? "font-style:italic;color:#555;" : "");
    d.addEventListener("mouseover", function () { d.style.background = "#eef3fa"; });
    d.addEventListener("mouseout",  function () { d.style.background = "#fff"; });
    bindPick(d, onPick);
    return d;
  }

  function render() {
    var q = input.value;
    box.innerHTML = "";
    if (q.length < 2) { hide(); return; }

    var hits = search(q);
    setED("isco_ncand", String(hits.length));

    hits.slice(0, MAX_SHOWN).forEach(function (h) {
      box.appendChild(row(h.l, false, function () { choose(h); }));
    });

    box.appendChild(row(NOMATCH_TEXT, true, function () {
      clearCode();
      setED("isco_source", "nomatch");
      hide();
      input.blur();
    }));

    box.style.display = "block";

    /* keep the list in view above the keyboard */
    if (box.scrollIntoView) {
      box.scrollIntoView({ block: "nearest" });
    }
  }

  var timer = null;
  input.addEventListener("input", function () {
    clearCode();
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  });

  input.addEventListener("blur", function () {
    setTimeout(function () { if (!picking) { hide(); } }, 250);
  });

  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { hide(); }
  });

  /* tapping anywhere else closes the list */
  document.addEventListener("pointerdown", function (ev) {
    if (!anchor.contains(ev.target)) { hide(); }
  });
});

Qualtrics.SurveyEngine.addOnUnload(function () {
  var c = this.getQuestionContainer();
  var input = c ? c.querySelector("input[type=text]") : null;
  if (input && input.value && !Qualtrics.SurveyEngine.getEmbeddedData("isco08")) {
    Qualtrics.SurveyEngine.setEmbeddedData("isco_source", "freetext_only");
  }
});
