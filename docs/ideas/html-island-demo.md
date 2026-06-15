# HTML Island Demo

A scratch document for eyeballing the HTML island MVP. Open it in the app: the
fenced `html` block below should render as a sandboxed iframe in read mode, and
the `edit` button should give a split source/preview.

## Feature comparison

```html
<div style="font-family: system-ui; border: 1px solid #555; border-radius: 8px; padding: 12px;">
  <h3 style="margin-top: 0;">Plan comparison</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr style="background: rgba(255,255,255,0.06);">
      <th style="text-align: left; padding: 6px;">Feature</th>
      <th style="padding: 6px;">Basic</th>
      <th style="padding: 6px;">Pro</th>
    </tr>
    <tr>
      <td style="padding: 6px;">Seats</td>
      <td style="padding: 6px; text-align: center; color: #8ec07c;">5</td>
      <td style="padding: 6px; text-align: center; color: #8ec07c;">Unlimited</td>
    </tr>
    <tr>
      <td style="padding: 6px;">SSO</td>
      <td style="padding: 6px; text-align: center; color: #fb4934;">—</td>
      <td style="padding: 6px; text-align: center; color: #8ec07c;">✓</td>
    </tr>
  </table>
</div>
```

## Scripts must not run (security check)

The button below must do nothing in read mode — the sandbox omits `allow-scripts`.

```html
<button onclick="alert('this should NEVER fire')">Click me</button>
<script>document.body.style.background = 'red'</script>
<p>If the page background is still normal and the alert never showed, the sandbox is holding.</p>
```

## Interactive island (Phase 3)

This `interact` island runs JavaScript — but only after you click **▶ Run**. The
slider should live-update the label and the bar width once running. It is
sandboxed: no network, no access to the app or vault.

```interact
<label>Amplitude: <input type="range" id="amp" min="0" max="100" value="40"></label>
<output id="out">40</output>
<div style="height: 16px; background: #89b4fa; width: 40%; border-radius: 4px; margin-top: 8px;" id="bar"></div>
<script>
  const amp = document.getElementById('amp')
  const out = document.getElementById('out')
  const bar = document.getElementById('bar')
  amp.addEventListener('input', () => {
    out.textContent = amp.value
    bar.style.width = amp.value + '%'
  })
</script>
```

Network access is blocked even when running — this fetch must fail silently:

```interact
<p id="status">attempting fetch…</p>
<script>
  fetch('https://example.com')
    .then(() => { document.getElementById('status').textContent = 'fetch SUCCEEDED (unexpected!)' })
    .catch(() => { document.getElementById('status').textContent = 'fetch blocked by CSP ✓' })
</script>
```

Back to regular markdown prose after the islands.
