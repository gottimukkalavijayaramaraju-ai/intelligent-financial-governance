# Intelligent Financial Governance

A simple base project that enforces spending policies, scores transaction risk and routes risky payments to an approver.

## Run
Open `index.html` in any browser. No installation needed.

## Files
- `index.html` - page layout
- `style.css` - styling (light and dark mode)
- `script.js` - rules engine, approval workflow, audit log

## Rules (in `evaluate()` in script.js)
1. Blocked merchant: rejected automatically
2. Amount above approval limit: needs approval
3. Unusual amount for category (z-score): needs approval
4. Possible duplicate payment: needs approval
5. Monthly category budget exceeded: needs approval

Data is stored in the browser (localStorage). Use "Reset demo data" to restore the sample set.
