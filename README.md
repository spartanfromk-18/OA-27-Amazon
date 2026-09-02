<div align="center">

<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3MiIgaGVpZ2h0PSI3MiIgdmlld0JveD0iMCAwIDMyIDMyIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI3IiBmaWxsPSIjMGQwZDBmIi8+PHBhdGggZD0iTTE2IDZ2MTBsNyA0IiBzdHJva2U9IiNmNWE1MjQiIHN0cm9rZS13aWR0aD0iMi41IiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxMCIgc3Ryb2tlPSIjZjVhNTI0IiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=" width="72" alt="OA Trainer logo" />

# OA Trainer
**A high-fidelity, timed mock of the Amazon SDE Intern Online Assessment**

Six sections · 165 minutes · 59 items · Strict timers · No way back

[![License: MIT](https://img.shields.io/badge/License-MIT-0d0d0f?style=for-the-badge)](#)
[![No dependencies](https://img.shields.io/badge/dependencies-0-2ea44f?style=for-the-badge)](#)
[![Vanilla JS](https://img.shields.io/badge/vanilla-JS-f7df1e?style=for-the-badge)](#)
[![Payload](https://img.shields.io/badge/payload-~100_KB-blue?style=for-the-badge)](#)
[![Backend](https://img.shields.io/badge/backend-none-lightgrey?style=for-the-badge)](#)
[![Responsive](https://img.shields.io/badge/responsive-375px_%E2%86%92_4K-purple?style=for-the-badge)](#)

</div>

<br />

> **The Challenge:** Most OA preparation relies on static LeetCode lists. However, candidates frequently fail due to the *assessment format*—strict per-section timers, irreversible submissions, and one-way logical reasoning blocks. **OA Trainer** reproduces this exact pressure environment, ensuring the real assessment isn't the first time you experience it.

## ✨ Core Features

* **⏱️ Unforgiving Timers:** Fixed per-section countdowns with progress tracking. The UI reacts to low time (amber under 5m, pulsing red under 1m) and auto-submits exactly at zero, finished or not.
* **🔒 Strict Section Gating:** Once submitted, a section locks permanently. No reopening, no second passes, and no early access to model solutions.
* **📊 Actionable Analytics:** Detailed post-assessment reports including scores, completion rates, time utilization, and question-by-question comparative analysis.
* **🎯 Outcome Calibration:** Section-by-section breakdowns offering performance predictions. It highlights the reality of the OA: coding performance dictates the outcome, and strong MCQ scores cannot mask weak algorithms.
* **⌨️ Keyboard-First Navigation:** Fully navigable via keyboard (`1-4` for MCQs, `Enter`/`→` to advance) for maximum efficiency.
* **♿ Built for Accessibility:** Includes dark and light themes, semantic HTML, visible focus rings, ARIA roles, and a fully responsive design down to 375px.

---

## 📋 Assessment Structure

Run the full mock end-to-end, or drill specific sections to target weaknesses.

| Section | Items | Time | Competency Tested |
| :--- | :---: | :---: | :--- |
| **Code Debugging** | 7 | 20 min | Identify logical and syntactical defects in buggy snippets. |
| **Coding Assessment** | 2 | 70 min | Full algorithm problems. Write approach, complexity, and implementation. |
| **Core CS MCQs** | 20 | 25 min | OS, Linux, DBMS, Algorithms, and Java fundamentals. |
| **Logical Reasoning** | 10 | 20 min | Series, syllogisms, direction sense, and probability. |
| **Work Simulation** | 8 | 20 min | Workplace scenarios mapped directly to Leadership Principles. |
| **Workstyles** | 12 | 10 min | Paired behavioral statements. Evaluates consistency, not correctness. |

### Architectural & Design Decisions

* **One-Way Logical Reasoning:** Mimicking the reported actual environment, the logical reasoning block removes the "Previous" button. This forces you to commit to an answer and move forward, preventing the detrimental habit of skipping and returning.
* **Unscored Workstyles:** Behavioral questions consist of equally desirable statements to test consistency rather than correctness. OA Trainer outputs a Leadership Principle alignment report rather than a numerical score.
* **Self-Assessed Coding:** Instead of a heavy backend execution engine, you write your code in a real editor pane under a strict clock. Upon submission, your answer is displayed side-by-side with optimal model solutions and complexity analyses.
* **Zero-State Architecture:** Progress is intentionally kept in memory, not `localStorage`. Refreshing the page wipes the session. A true mock exam should be taken in a single, uninterrupted sitting.

---

## 🚀 Getting Started

OA Trainer requires zero dependencies and has no build step.

**Run it locally**
```bash
git clone [https://github.com/YOUR-USERNAME/oa-trainer.git](https://github.com/YOUR-USERNAME/oa-trainer.git)
cd oa-trainer
python3 -m http.server 8000
