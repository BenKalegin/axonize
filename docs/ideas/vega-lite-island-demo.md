# Vega-Lite island demo

Axonize renders a fenced ` ```vega-lite ` block as an inline SVG chart, via the
doodles chart pipeline (`importVegaLiteChart` → `renderChartSvg`). Supported
subset: inline `data.values`, marks bar/line/point/area/rule, and x/y (+color)
encodings.

## Bar chart

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": {"values": [
    {"month": "Jan", "sales": 28},
    {"month": "Feb", "sales": 55},
    {"month": "Mar", "sales": 43},
    {"month": "Apr", "sales": 91},
    {"month": "May", "sales": 81},
    {"month": "Jun", "sales": 53}
  ]},
  "mark": "bar",
  "encoding": {
    "x": {"field": "month", "type": "nominal"},
    "y": {"field": "sales", "type": "quantitative"}
  }
}
```

## Line chart

```vega-lite
{
  "data": {"values": [
    {"t": 0, "v": 1},
    {"t": 1, "v": 4},
    {"t": 2, "v": 9},
    {"t": 3, "v": 16},
    {"t": 4, "v": 25}
  ]},
  "mark": "line",
  "encoding": {
    "x": {"field": "t", "type": "quantitative"},
    "y": {"field": "v", "type": "quantitative"}
  }
}
```

## Error case

A non-Vega block shows a clear message rather than throwing:

```vega-lite
not a spec
```
