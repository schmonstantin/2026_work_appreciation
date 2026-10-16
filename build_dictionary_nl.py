#!/usr/bin/env python3
"""
Build the Dutch occupation lookup dictionary from the WISCO workbook.

Usage (WISCO titles only, no aliases):
    python3 build_dictionary_nl.py WISCO_with_SIOPS_OESCH.xlsx 2026_10_15_wisco_nl.json

Optional, once the team has agreed an alias list:
    python3 build_dictionary_nl.py WISCO_with_SIOPS_OESCH.xlsx 2026_10_15_wisco_nl.json --aliases nl_aliases.csv

SIOPS-08 is read from the "SIOPS" column of the MAPPINGS sheet (added next
to NACE2.0 from Ganzeboom & Treiman's isqotrei08.sps). The workbook must have
been saved with calculated values (it is, as delivered).

The Oesch EMPLOYEE class (5-16) is read from the "OESCH_EMP" column of
MAPPINGS (from Oesch's Final_proposition_passage_ISCO08_Oesch_10_06_2014.xls).
It is stored as field "o". Classes 1-4 (self-employed) are assigned after
fieldwork from employment status and number of employees.

Change LOCALE to 'de_DE' or 'en_GB' for the other languages. An alias file is
language specific: each alias points at an EXISTING WISCO label in the same
language and inherits its ISCO code, ISEI, skill level and SIOPS.

Traps in the workbook, all handled here:
  1. Rows whose ID starts with '-' are search-tree category nodes, not jobs.
  2. Excel stored IDs as numbers: leading zeros are lost (zero-padded back)
     and a few long IDs became floats in scientific notation (dropped).
  3. Codes are taken from the MAPPINGS sheet, not sliced from the ID.
"""
import argparse, csv, json, collections
import openpyxl

LOCALE = "nl_NL"

def norm_id(v):
    if v is None:
        return None
    if isinstance(v, float):
        return "%.0f" % v
    return str(v).strip()

def main(xlsx, out_json, alias_csv=None):
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)

    def load(sheet):
        it = wb[sheet].iter_rows(values_only=True)
        return list(next(it)), list(it)

    h_code, codeset = load("CODESET")
    h_map, mappings = load("MAPPINGS")
    i_isco, i_isei, i_lv = (h_map.index(c) for c in ("ISCO0804", "ISCOISEI", "ISCO08lv"))
    i_lab = h_code.index(LOCALE)
    i_siops = h_map.index("SIOPS") if "SIOPS" in h_map else None
    i_oesch = h_map.index("OESCH_EMP") if "OESCH_EMP" in h_map else None

    mp, siops, oesch = {}, {}, {}
    for r in mappings:
        k = norm_id(r[0])
        if k:
            code = str(r[i_isco]).zfill(4)
            mp[k.zfill(13)] = (code, r[i_isei], r[i_lv])
            if i_siops is not None and r[i_siops] not in (None, ""):
                siops[code] = round(float(r[i_siops]), 2)
            if i_oesch is not None and r[i_oesch] not in (None, ""):
                oesch[code] = int(r[i_oesch])

    entries, stats = {}, collections.Counter()
    for r in codeset:
        k = norm_id(r[0])
        if not k or k == "None":
            continue
        if k.startswith("-"):
            stats["category nodes dropped"] += 1
            continue
        if "e+" in k.lower():
            stats["corrupted float IDs dropped"] += 1
            continue
        lab = r[i_lab]
        if not lab or not str(lab).strip():
            stats["blank labels"] += 1
            continue
        rec = mp.get(k.zfill(13))
        if rec is None:
            stats["IDs not in MAPPINGS"] += 1
            continue
        label = " ".join(str(lab).split())
        entries[(label.lower(), rec[0])] = {"l": label, "i": rec[0], "e": rec[1], "s": rec[2]}

    if alias_csv:
        by_label = {e["l"]: e for e in entries.values()}
        with open(alias_csv, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                target = by_label.get(row["points_to_wisco_label"])
                if target is None:
                    stats["aliases skipped (target not found)"] += 1
                    continue
                e = dict(target, l=row["alias"])
                entries.setdefault((e["l"].lower(), e["i"]), e)
                stats["aliases added"] += 1

    out = sorted(entries.values(), key=lambda e: e["l"].lower())
    for e in out:
        if e["i"] in siops:
            e["p"] = siops[e["i"]]
        if e["i"] in oesch:
            e["o"] = oesch[e["i"]]
    stats["entries without SIOPS"] = sum(1 for e in out if "p" not in e)
    stats["entries without Oesch employee class"] = sum(1 for e in out if "o" not in e)

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print("entries written:", len(out))
    print("distinct ISCO-08 4-digit codes:", len({e["i"] for e in out}))
    for k, v in stats.items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("xlsx")
    ap.add_argument("out_json")
    ap.add_argument("--aliases", default=None)
    a = ap.parse_args()
    main(a.xlsx, a.out_json, a.aliases)
