/* ------------------------------------------------------------------
   Occupation lookup for Qualtrics - WISCO / ISCO-08
   VERSION 5: multilingual strings (nl / en / de), SIOPS-08 field,
   stored miss text, keyboard navigation, paradata.

   Builds on v4 (which is confirmed working). Unchanged from v4:
   setJSEmbeddedData with UNPREFIXED names in the code, and "__js_"
   prefixed names in the Survey Flow.

   SURVEY FLOW: declare these eleven fields, all with the __js_ prefix,
   in one Embedded Data element ABOVE the question block, values empty:

       __js_isco_label    __js_isco08       __js_isco_isei
       __js_isco_skill    __js_isco_siops   __js_isco_oesch
       __js_isco_source   __js_isco_ncand   __js_isco_misstext
       __js_isco_keys     __js_isco_secs

   Apply, then PUBLISH (flow changes do not reach the live link until
   you republish).

   OTHER SETUP
   - Attach to the single-line Text Entry question (gear icon > Add
     JavaScript), replacing the three empty stubs.
   - PAGE BREAK immediately after the question.
   - Set DICT_URL and LANG below.

   DICTIONARY FORMAT (one JSON array):
       {"l": "Leerkracht basisschool", "i": "2341", "e": 61, "s": 4, "p": 57, "o": 14}
       l = label, i = ISCO-08 4-digit (string, keep leading zeros),
       e = ISEI-08, s = ISCO skill level, p = SIOPS-08,
       o = Oesch EMPLOYEE class (5-16). This is the class the respondent
           has IF they are an employee. Self-employed respondents are
           reclassified into classes 1-4 after fieldwork, using employment
           status and number of employees. Empty for ISCO 0310.
       w = optional frequency weight; if present, higher w ranks first.
   Entries without p simply store an empty SIOPS value.

   New in v5:
   - UI strings for nl / en / de in one table (STRINGS).
   - isco_misstext: the text typed when the respondent chose "not in
     list" or never selected. This is your miss log, as data.
   - isco_keys / isco_secs: keystrokes and seconds on the question.
   - Arrow keys and Enter select suggestions; basic ARIA roles.
   - Duplicate labels (same text, different ISCO code) get a short
     major-group hint so respondents do not pick blind.
   - A visible note if the dictionary fails to load.
   - Compound-insensitive search: "vrachtwagenchauffeur" now finds
     "Vrachtwagen chauffeur". On 58 common Dutch job titles this raised
     the hit rate from 45 to 52. The remaining misses are words absent
     from WISCO altogether; those are a dictionary question, not a script
     question.

   Set DEBUG to false before distributing.

   Data source: Tijdens, K.G. (2023), Occupations_ISCO08_5dgt,
   WISCO database, SurveyCodings / WageIndicator Foundation.
------------------------------------------------------------------- */

Qualtrics.SurveyEngine.addOnReady(function () {

  /* ---------------- configuration ---------------- */
  var DICT_URL  = "https://schmonstantin.github.io/2026_work_appreciation/2026_10_15_wisco_nl.json";
  var LANG      = "nl";          /* "nl", "en" or "de" */
  var MAX_SHOWN = 8;
  var DEBUG     = true;

  var STRINGS = {
    nl: {
      nomatch: "Mijn beroep staat niet in deze lijst",
      placeholder: "bijv. verpleegkundige, lasser, marktonderzoeker",
      unavailable: "Suggesties zijn niet beschikbaar. Typ uw beroep gewoon in uw eigen woorden.",
      majors: {
        "0": "militair", "1": "leidinggevend", "2": "academisch niveau",
        "3": "hoger beroepsniveau", "4": "administratief", "5": "dienstverlening en verkoop",
        "6": "landbouw en visserij", "7": "ambacht en techniek",
        "8": "machines en transport", "9": "elementair"
      }
    },
    en: {
      nomatch: "My job is not in this list",
      placeholder: "e.g. nurse, welder, market researcher",
      unavailable: "Suggestions are not available. Please type your job in your own words.",
      majors: {
        "0": "armed forces", "1": "managers", "2": "professionals",
        "3": "technicians and associate professionals", "4": "clerical",
        "5": "service and sales", "6": "agriculture and fishery",
        "7": "crafts and trades", "8": "plant, machine and transport",
        "9": "elementary"
      }
    },
    de: {
      nomatch: "Mein Beruf ist nicht dabei",
      placeholder: "z. B. Krankenpfleger, Schweisser, Marktforscherin",
      unavailable: "Vorschlaege sind nicht verfuegbar. Bitte geben Sie Ihren Beruf in eigenen Worten ein.",
      majors: {
        "0": "Militaer", "1": "Fuehrungskraefte", "2": "akademische Berufe",
        "3": "Techniker und gleichrangige Berufe", "4": "Buerokraefte",
        "5": "Dienstleistung und Verkauf", "6": "Land- und Forstwirtschaft",
        "7": "Handwerk", "8": "Maschinen und Transport", "9": "Hilfsarbeit"
      }
    }
  };
  var T = STRINGS[LANG] || STRINGS.en;

  function log() {
    if (DEBUG && window.console) {
      console.log.apply(console, ["[isco]"].concat([].slice.call(arguments)));
    }
  }

  var question  = this;
  var container = this.getQuestionContainer();
  var input = container.querySelector("input[type=text]");
  if (!input) { log("no text input found"); return; }

  /* addOnReady can fire twice; bind only once */
  if (input.getAttribute("data-isco-bound") === "1") { log("already bound"); return; }
  input.setAttribute("data-isco-bound", "1");

  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("placeholder", T.placeholder);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  /* ---------------- state and storage ---------------- */
  var t0 = Date.now();
  var state = {
    label: "", isco: "", isei: "", skill: "", siops: "", oesch: "",
    source: "", ncand: "0", misstext: "", keys: 0
  };

  /* Field names here are UNPREFIXED. The prefix lives in the Survey Flow. */
  function setED(k, v) {
    try {
      if (typeof Qualtrics.SurveyEngine.setJSEmbeddedData === "function") {
        Qualtrics.SurveyEngine.setJSEmbeddedData(k, v);
      } else {
        Qualtrics.SurveyEngine.setEmbeddedData(k, v);
      }
      log("set", k, "=", JSON.stringify(v));
    } catch (err) {
      log("FAILED to set", k, err);
    }
  }

  function commit() {
    setED("isco_label",    state.label);
    setED("isco08",        state.isco);
    setED("isco_isei",     state.isei);
    setED("isco_skill",    state.skill);
    setED("isco_siops",    state.siops);
    setED("isco_oesch",    state.oesch);
    setED("isco_source",   state.source);
    setED("isco_ncand",    state.ncand);
    setED("isco_misstext", state.misstext);
    setED("isco_keys",     String(state.keys));
    setED("isco_secs",     String(Math.round((Date.now() - t0) / 1000)));
  }

  /* ---------------- dropdown container ---------------- */
  var anchor = document.createElement("div");
  anchor.style.cssText = "position:relative;width:100%;";
  input.parentNode.insertBefore(anchor, input);
  anchor.appendChild(input);

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

  var note = document.createElement("div");
  note.style.cssText = "display:none;margin-top:6px;font-size:0.85em;color:#8a5b00;";
  note.textContent = T.unavailable;
  anchor.appendChild(note);

  /* ---------------- dictionary ---------------- */
  var dict = [];
  var dupes = {};          /* normalised label -> true if it maps to >1 code */
  var picking = false;

  /* Slashes and hyphens are deleted rather than turned into spaces, so
     "Grafiker/in" indexes as "grafikerin". Umlaut folding is inert in
     Dutch and English and keeps the function usable for German. */
  function norm(s) {
    return String(s).toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe")
      .replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[\/\-]/g, "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  fetch(DICT_URL)
    .then(function (r) { log("dictionary HTTP", r.status); return r.json(); })
    .then(function (d) {
      var seen = {};
      dict = d.map(function (e) {
        var n = norm(e.l);
        if (seen[n] && seen[n] !== e.i) { dupes[n] = true; }
        seen[n] = e.i;
        return { l: e.l, i: e.i, e: e.e, s: e.s, p: e.p, o: e.o, w: e.w || 0,
                 n: n, ns: n.replace(/ /g, "") };
      });
      log("dictionary loaded:", dict.length, "entries,",
          Object.keys(dupes).length, "ambiguous labels");
    })
    .catch(function (err) {
      log("dictionary FAILED to load", err);
      note.style.display = "block";
    });

  function byWeight(a, b) {
    if (b.w !== a.w) { return b.w - a.w; }
    return a.l < b.l ? -1 : (a.l > b.l ? 1 : 0);
  }

  /* All query tokens must appear in the label. Labels starting with the
     first token rank above labels merely containing it; within each
     group, higher frequency weight first, then alphabetical. */
  function search(q) {
    var nq = norm(q);
    var toks = nq.split(" ").filter(Boolean);
    var qs = nq.replace(/ /g, "");     /* query with spaces removed */
    if (!toks.length || !dict.length) { return []; }
    var starts = [], contains = [];
    for (var k = 0; k < dict.length; k++) {
      var e = dict[k], ok = true, viaStripped = false;
      for (var t = 0; t < toks.length; t++) {
        if (e.n.indexOf(toks[t]) === -1) { ok = false; break; }
      }
      /* Compound-insensitive fallback. WISCO writes Dutch compounds with a
         space ("Vrachtwagen chauffeur") but respondents type them together
         ("vrachtwagenchauffeur"). Compare with spaces removed on both
         sides; require 5+ characters to avoid noisy short matches. */
      if (!ok && qs.length >= 5 && e.ns.indexOf(qs) !== -1) {
        ok = true; viaStripped = true;
      }
      if (!ok) { continue; }
      var isStart = viaStripped ? (e.ns.indexOf(qs) === 0)
                                : (e.n.indexOf(toks[0]) === 0);
      if (isStart) { starts.push(e); } else { contains.push(e); }
    }
    starts.sort(byWeight); contains.sort(byWeight);
    return starts.concat(contains);
  }

  /* ---------------- interaction ---------------- */
  var items = [];          /* DOM rows currently shown, including "not in list" */
  var active = -1;

  function hide() {
    box.style.display = "none";
    input.setAttribute("aria-expanded", "false");
    active = -1;
  }

  function clearCode() {
    state.label = ""; state.isco = ""; state.isei = "";
    state.skill = ""; state.siops = ""; state.oesch = "";
  }

  function choose(item) {
    input.value  = item.l;
    state.label  = item.l;
    state.isco   = item.i;
    state.isei   = (item.e === undefined || item.e === null) ? "" : String(item.e);
    state.skill  = (item.s === undefined || item.s === null) ? "" : String(item.s);
    state.siops  = (item.p === undefined || item.p === null) ? "" : String(item.p);
    state.oesch  = (item.o === undefined || item.o === null) ? "" : String(item.o);
    state.source = "lookup";
    state.misstext = "";
    commit();
    hide();
    input.blur();               /* dismisses the phone keyboard */
  }

  function chooseNoMatch() {
    state.misstext = input.value;
    clearCode();
    state.source = "nomatch";
    commit();
    hide();
    input.blur();
  }

  /* pointerdown covers mouse, touch and pen in one event. preventDefault
     stops the input losing focus, which broke tap selection on iOS. */
  function bindPick(el, fn) {
    el.addEventListener("pointerdown", function (ev) {
      ev.preventDefault(); picking = true; fn(); picking = false;
    });
    if (!window.PointerEvent) {
      el.addEventListener("touchstart", function (ev) {
        ev.preventDefault(); picking = true; fn(); picking = false;
      }, { passive: false });
      el.addEventListener("mousedown", function (ev) {
        ev.preventDefault(); picking = true; fn(); picking = false;
      });
    }
  }

  function paintActive() {
    items.forEach(function (el, k) {
      el.style.background = (k === active) ? "#eef3fa" : "#fff";
    });
    if (active >= 0 && items[active] && items[active].scrollIntoView) {
      items[active].scrollIntoView({ block: "nearest" });
    }
  }

  function row(text, hint, italic, onPick) {
    var d = document.createElement("div");
    d.setAttribute("role", "option");
    d.style.cssText = "padding:12px 12px;min-height:44px;cursor:pointer;" +
      "line-height:1.35;border-bottom:1px solid #f0f0f0;" +
      (italic ? "font-style:italic;color:#555;" : "");
    var main = document.createElement("span");
    main.textContent = text;
    d.appendChild(main);
    if (hint) {
      var h = document.createElement("span");
      h.textContent = "  (" + hint + ")";
      h.style.cssText = "color:#777;font-size:0.85em;";
      d.appendChild(h);
    }
    d.addEventListener("mouseover", function () {
      active = items.indexOf(d); paintActive();
    });
    bindPick(d, onPick);
    return d;
  }

  function render() {
    var q = input.value;
    box.innerHTML = "";
    items = []; active = -1;
    if (q.length < 2) { hide(); return; }

    var hits = search(q);
    state.ncand = String(hits.length);
    log("query", JSON.stringify(q), "->", hits.length, "hits");

    hits.slice(0, MAX_SHOWN).forEach(function (h) {
      var hint = dupes[h.n] ? (T.majors[h.i.charAt(0)] || "") : "";
      var el = row(h.l, hint, false, function () { choose(h); });
      items.push(el); box.appendChild(el);
    });

    var none = row(T.nomatch, "", true, chooseNoMatch);
    items.push(none); box.appendChild(none);

    box.style.display = "block";
    input.setAttribute("aria-expanded", "true");
    if (box.scrollIntoView) { box.scrollIntoView({ block: "nearest" }); }
  }

  var timer = null;
  input.addEventListener("input", function () {
    state.keys++;
    clearCode();
    if (state.source !== "nomatch") { state.source = "freetext_only"; }
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  });

  input.addEventListener("keydown", function (ev) {
    var open = box.style.display === "block" && items.length;
    if (ev.key === "Escape") { hide(); return; }
    if (!open) { return; }
    if (ev.key === "ArrowDown") {
      ev.preventDefault(); active = (active + 1) % items.length; paintActive();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault(); active = (active <= 0 ? items.length : active) - 1; paintActive();
    } else if (ev.key === "Enter" && active >= 0) {
      ev.preventDefault();
      /* last row is always "not in list"; others map to the hit order */
      var el = items[active];
      var evt = document.createEvent("Event");
      evt.initEvent("pointerdown", true, true);
      el.dispatchEvent(evt);
    }
  });

  input.addEventListener("blur", function () {
    setTimeout(function () { if (!picking) { hide(); } }, 250);
  });

  document.addEventListener("pointerdown", function (ev) {
    if (!anchor.contains(ev.target)) { hide(); }
  });

  /* write once more as the page is saved */
  question.addOnPageSubmit(function () {
    if (!state.source && input.value) { state.source = "freetext_only"; }
    if (state.source !== "lookup" && !state.misstext) { state.misstext = input.value; }
    log("page submit, committing:", JSON.stringify(state));
    commit();
  });
});
