<div align="center">
  <img src="favicon.svg" alt="LeanSigma" width="64" height="64" />
  <h1>LeanSigma</h1>
  <p><strong>Zero-build, local-first Lean &amp; Six Sigma analytical workbench for turning messy shop-floor spreadsheets into SPC, OEE, Pareto, VSM, and Root-Cause visuals.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Architecture-Zero--Build%20ESM-45E1A5?style=flat-square&labelColor=0A113E" alt="Zero-Build ESM" />
    <img src="https://img.shields.io/badge/Privacy-100%25%20Browser--Local-D929CF?style=flat-square&labelColor=0A113E" alt="100% Browser-Local" />
    <img src="https://img.shields.io/badge/Ingestion-.xlsx%20%7C%20.csv%20%7C%20Excel%20Paste-59A8A2?style=flat-square&labelColor=0A113E" alt="Ingestion" />
  </p>
</div>

---

## Core Capabilities

### 1. Universal Spreadsheet & Clipboard Ingestion (`Import Data` or `i`)
- **Multi-Sheet Excel & CSV**: Drop `.xlsx`, `.xls`, `.csv`, `.tsv`, or `.txt` files directly in the browser (powered locally by SheetJS + an RFC-4180 delimiter parser) and switch between workbook sheets without re-uploading.
- **Direct Excel / Sheets `Ctrl+V` Paste**: Copy cells—or even a single headerless column of numbers—straight from Excel and paste.
- **Messy-Sheet Cleanup**: Auto-skips leading blank rows, single-cell title banners, and empty leading columns, with manual **First row is headers** and **Start Row #** overrides.
- **Data Provenance**: Every module displays a live **Data Source badge** (imported file/sheet/column vs. manual edit vs. cross-link vs. sample demo) and a **Raw Data** modal to inspect the underlying rows.

### 2. Eight Modules (`1`–`8` Shortcuts · `#capability`..`#export` URL Hash)
1. **Capability & SPC** — Empirical $C_p/C_{pk}$ (within-subgroup via $\overline{MR}/d_2$), $P_p/P_{pk}$ (overall), **Anderson-Darling** normality test badge, **Normal / Lognormal / Non-Parametric (ISO 22514-2)** toggle, observed vs. expected PPM, and companion **I-MR Control Chart** (Rule 1 & 8-pt run detection), plus an interactive Simulator toggle.
2. **OEE** — Multi-shift production log with line filtering, OEE/Availability/Performance/Quality trendlines (vs. 85% World Class), and time-loss waterfall, plus Single Shift sliders.
3. **Takt** — Yamazumi stacked cycle balance (`VA`, `BNVA`, `Waste`) against Takt time with bottleneck handoff to Ishikawa.
4. **Pareto** — Group raw defect/downtime logs by **Count** or **Weighted Impact** (cost/minutes) with group filtering and one-click **→ Ishikawa** seeding.
5. **VSM** — Value Stream Map with queue triangles, process data boxes, sawtooth lead-time ladder, PCE calculation, **Sync Steps → Takt**, and **Bottleneck → Ishikawa**.
6. **5S** — 5-axis workplace audit radar chart, 5×4 scoring matrix, benchmark slider, and corrective action log.
7. **Ishikawa** — Six-rib Fishbone (6M) root cause builder with root-suspect highlighting.
8. **Data & Export Hub** — Inspect all module data sources, load demo scenarios, and export **JSON**, **CSV**, **Copy TSV** (Excel-ready), **SVG**, **2x PNG**, **Markdown (`.md`)**, standalone **HTML**, or light-mode **Print / PDF**.

---

## Reference Sample Data

Built-in demo scenarios (*Precision CNC Cell*, *SMT Electronics Line*, *High-Speed Packaging*) are available under **Data & Export → Demo Scenarios**, and standalone reference CSVs are included in [`samples/`](samples/):

- [`samples/capability_measurements.csv`](samples/capability_measurements.csv) — 20 numeric inspection readings
- [`samples/oee_shift_log.csv`](samples/oee_shift_log.csv) — Multi-shift, multi-line OEE production log
- [`samples/pareto_defect_log.csv`](samples/pareto_defect_log.csv) — Raw defect events with scrap cost & line
- [`samples/takt_workstations.csv`](samples/takt_workstations.csv) — Workstation VA / BNVA / Waste cycle times
- [`samples/vsm_process_steps.csv`](samples/vsm_process_steps.csv) — Process chain steps with changeover, uptime & queue wait

---

## Running Locally

Because ES Modules require an HTTP origin, serve the repository root with any static server:

```bash
python -m http.server 8000
# or: npx serve .
```

Then open **http://localhost:8000** (or `http://localhost:3000`).

### Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `1` – `8` | Switch between modules |
| `i` | Open Import Data modal |
| `Esc` | Close open modal |

---

## Project Structure

```text
LeanSigma/
├── index.html                 # Application shell & module views
├── favicon.svg / favicon.ico  # App icons
├── styles/theme.css           # Industrial navy/mint/crimson tokens & print stylesheet
├── samples/                   # Reference CSV datasets for testing & import
├── src/
│   ├── constants.js           # Palette tokens, tab config, sample scenarios
│   ├── state.js               # localStorage persistence, provenance & migration
│   ├── utils.js               # Formatters, CSV/TSV builders, clipboard & downloads
│   ├── main.js                # Application bootstrap
│   ├── data/                  # parser.js, mapper.js, importDrawer.js
│   ├── modules/               # Pure *Math.js engines + DOM/SVG module controllers
│   ├── export/                # json.js, csv.js, svg.js, png.js, markdown.js, htmlReport.js
│   └── ui/                    # toast.js, navigation.js, sourceBadge.js
└── tests/                     # Native Node unit tests (node --test)
```

## Running Tests

Requires Node.js v20+ (zero external npm dependencies):

```bash
npm test
# or: node --test tests/*.test.mjs
```
