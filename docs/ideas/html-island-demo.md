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

Back to regular markdown prose after the islands.
