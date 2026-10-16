# Occupation lookup for web surveys (Dutch, ISCO-08)

This repository hosts the look-up dictionary used by a Qualtrics occupation question in the project *HERE* (University of Groningen, 2026). Respondents type their job title, pick the closest Dutch occupational title, and the survey stores its ISCO-08 code together with derived status measures.

## Files

| File | Content |
|---|---|
| `2026_10_16_wisco_nl.json` | Dutch occupational titles with ISCO-08 code and derived variables (see below) |
| `qualtrics_occupation_v5.js` | JavaScript for the Qualtrics text-entry question |
| `build_dictionary_nl.py` | Script that builds the JSON from the source files listed below |

### Fields in `2026_10_16_wisco_nl.json`

| Key | Meaning | Source |
|---|---|---|
| `l` | Occupational title, Dutch (`nl_NL`) | WISCO |
| `i` | ISCO-08, 4-digit unit group (text, leading zeros kept) | WISCO |
| `e` | ISEI-08 | WISCO (`MAPPINGS` sheet, from Ganzeboom) |
| `s` | ISCO-08 skill level (1-4) | WISCO |
| `p` | SIOPS-08 occupational prestige | Ganzeboom & Treiman, `isqotrei08.sps` |
| `o` | Oesch class for **employees** (classes 5-16 of the 16-class scheme) | Oesch, ISCO-08 to class mapping |

`o` is only valid for employees. Self-employed respondents are assigned Oesch classes 1-4 after fieldwork, from employment status and number of employees. ISCO-08 0310 (armed forces, other ranks) has no Oesch class in the source and is left empty.

## Sources and credits

This repository contains **derived data** (titles and per-code values). The original source files are not redistributed here; obtain them from the sources below.

### 1. WISCO occupation database

Kea Tijdens. (2023). WISCO occupations_ISCO08_5dgt_55languages_4000titles_with_mapping_surveycodings_20230425 (Version 20230425) [Dataset]. Zenodo. https://doi.org/10.5281/zenodo.8262593

Documentation: Tijdens, K.G. (2019). *Database of occupational titles, with explanatory note.* Deliverable 8.3 of the SERISS project, EU Horizon 2020 research and innovation programme, GA No. 654221.

WISCO is published under the Creative Commons Attribution 4.0 International licence (CC BY 4.0). Changes made here: category nodes of the search tree, records with unrecoverable identifiers, and titles without a Dutch translation were removed; duplicates were merged; SIOPS-08 and the Oesch employee class were added per ISCO-08 code.

### 2. SIOPS-08 occupational prestige

Ganzeboom, H.B.G., & Treiman, D.J. *International Stratification and Mobility File: Conversion Tools*, syntax module `isqotrei08.sps` ("Recode of ISCO-08 into SIOPS-08"). http://www.harryganzeboom.nl/ismf/index.htm

Underlying method: Ganzeboom, H.B.G., & Treiman, D.J. (1996). Internationally comparable measures of occupational status for the 1988 International Standard Classification of Occupations. *Social Science Research*, 25(3), 201-239.

### 3. ISEI-08

Values as included in WISCO, originating from Ganzeboom, H.B.G. (2010). A new International Socio-Economic Index (ISEI) of occupational status for the International Standard Classification of Occupation 2008 (ISCO-08). http://www.harryganzeboom.nl/isco08/

### 4. Oesch class scheme

Mapping: Oesch, D. (2014). `Final_proposition_passage_ISCO08_Oesch_10_06_2014.xls`, sheet "ISCO-08 English", column "Oesch Class". https://people.unil.ch/danieloesch/scripts/

Scheme: Oesch, D. (2006). *Redrawing the Class Map: Stratification and Institutions in Britain, Germany, Sweden and Switzerland.* Basingstoke: Palgrave Macmillan.
Oesch, D. (2006). Coming to grips with a changing class structure. *International Sociology*, 21(2), 263-288.

## Contact

Konstantin Schmandt, University of Groningen.
