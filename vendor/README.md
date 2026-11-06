# Vendored VexFlow

- Version: **VexFlow 5.0.0**
- Source: npm package `vexflow@5.0.0`, `build/cjs/vexflow.js`
- License: MIT — see `VEXFLOW-LICENSE.txt`
- Authors: see `VEXFLOW-AUTHORS.md`

This UMD bundle is committed so the PWA works fully offline without a CDN or build step.
The bundle includes the Bravura/Academico fonts as data URIs.

The application loads it with a classic `<script>` before the ES module entry:

```html
<script src="./vendor/vexflow.js"></script>
<script type="module" src="./js/app.js"></script>
```

`js/staff.js` uses the global `VexFlow` object.
