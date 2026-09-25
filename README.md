# keybr Stats Analyzer

A single-page site that goes deeper into your [keybr.com](https://www.keybr.com) typing data than the profile page does. It shows which keys and fingers slow you down and where you make mistakes, and it tracks how your speed changes over time.

**Live site:** https://agent3133.github.io/keybr_analyzer/

Everything runs in your browser. Your data is never uploaded anywhere.

## Features

### Analyze tab
- **Summary cards:** average and best WPM, accuracy, and total characters typed.
- **Keyboard heatmap:** average time per key, coloured from fast (green) to slow (red), with accuracy on each key.
- **Slowest keys and error rate per key:** bar charts of your weakest keys.
- **WPM across sessions:** a speed and accuracy trend that you can zoom and pan.
- **Finger analysis:** average time per finger, based on standard QWERTY touch typing.
- **Keys to focus on:** the keys that combine slowness and errors worst, so you know what to practise.

### Progress tab
- **Daily stats:** average, 80th percentile, 95th percentile and best WPM for each day, with the number of tests you did that day.
- **Progress estimate:** a regression over your last 10 active days that shows how many WPM you gain per 10 tests, with a short projection ahead.

Each session you analyze is saved in your browser's IndexedDB storage, and repeated sessions are skipped, so your history builds up over time. There's room for many thousands of sessions. Use **Clear history** on the Progress tab to start over.

## Usage

### One-click sync (recommended)

1. Open the [live site](https://agent3133.github.io/keybr_analyzer/) and drag the **keybr → Analyzer** button to your bookmarks bar.
2. Whenever you want fresh stats, open [keybr.com](https://www.keybr.com) and click the bookmark.

The analyzer opens with all your typing data loaded. Sessions already in your history are skipped, so you can sync as often as you like.

How it works: the bookmark runs on keybr.com and reads your data there.
- If you're signed in, it reads your account data from keybr's `/_/sync/data` endpoint.
- If you're not signed in, it reads the history keybr keeps in your browser.

It then passes the data to the analyzer window with `postMessage`. Both sides check the other's origin, and the data never goes anywhere else. The bookmark is self-contained and loads no external code into your keybr session.

The sync depends on keybr's internal data format, which keybr can change without notice. If the sync stops working, use the file export below.

### From a file

1. On your keybr.com profile page, click **Download data** to save `typing-data.json`.
2. On the analyzer, click **Open file…** and pick that file, or paste the JSON into the text box and click **Analyze**.

To try the analyzer without your own data, click **See Demo**.

### Input format

The analyzer accepts either one session object or an array of sessions. Each session needs a `histogram`. The Progress tab also needs `timeStamp`, and WPM needs `length` and `time`.

```json
{
  "timeStamp": "2026-02-23T08:46:29.549Z",
  "length": 177,
  "time": 60094,
  "errors": 7,
  "histogram": [
    { "codePoint": 116, "hitCount": 17, "missCount": 1, "timeToType": 323.9 }
  ]
}
```

| Field | Meaning |
|---|---|
| `length` | Characters typed in the session |
| `time` | Session duration in milliseconds |
| `errors` | Mistyped characters |
| `histogram[].codePoint` | Unicode code point of the key (32 = space) |
| `histogram[].timeToType` | Average milliseconds to type that key |

WPM is calculated as `(length / 5) / minutes`.

## Running locally

The site has no build step. The demo button loads `demo_keybr_history.json` with `fetch`, so serve the folder over HTTP instead of opening `index.html` directly:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page markup and tabs |
| `keybr_analyzer.js` | Parsing, statistics and chart rendering |
| `keybr_sync.js` | Source of the one-click sync bookmarklet (runs on keybr.com) |
| `keybr_analyzer.css` | Styles, including light and dark themes |
| `demo_keybr_history.json` | Sample data for the **See Demo** button |

Charts use [Chart.js](https://www.chartjs.org/) and [chartjs-plugin-zoom](https://www.chartjs.org/chartjs-plugin-zoom/), both loaded from a CDN. The site is hosted on GitHub Pages from the `master` branch.
