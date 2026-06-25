// 错题附图渲染组件：把识别出的结构化 figure 用代码重绘清晰图形。
// 支持 type: counter(计数器) / numberline(数轴/线段图) / shape(几何) / image(无法结构化，外部用原图)
Component({
  properties: {
    figure: { type: Object, value: null }
  },
  data: { model: null },
  observers: {
    'figure': function (fig) { this.setData({ model: buildModel(fig) }) }
  }
})

function clampNum(v, lo, hi, dft) {
  var n = Number(v)
  if (isNaN(n)) return dft
  return Math.max(lo, Math.min(hi, n))
}

function buildModel(fig) {
  if (!fig || !fig.type) return null

  if (fig.type === 'counter') {
    var columns = (fig.columns || []).slice(0, 5).map(function (c) {
      var n = clampNum(c.beads, 0, 18, 0)
      var beads = []
      for (var i = 0; i < n; i++) beads.push(i)
      return { label: String(c.label || ''), beads: beads }
    })
    if (!columns.length) return null
    return { type: 'counter', columns: columns }
  }

  if (fig.type === 'numberline') {
    var min = Number(fig.min), max = Number(fig.max)
    var step = Number(fig.step) || 1
    if (isNaN(min) || isNaN(max) || max <= min) return null
    var span = max - min
    var count = Math.round(span / step)
    if (count > 30 || count < 1) { count = Math.min(20, Math.max(2, Math.round(span))); step = span / count }
    var ticks = []
    for (var v = 0; v <= count; v++) {
      var val = min + v * step
      ticks.push({ val: +val.toFixed(2), pct: (val - min) / span * 100 })
    }
    var marks = (fig.marks || []).slice(0, 6).map(function (m) {
      var mv = Number(m.value)
      return { label: String(m.label != null ? m.label : (isNaN(mv) ? '?' : mv)), pct: isNaN(mv) ? 0 : (mv - min) / span * 100 }
    }).filter(function (m) { return m.pct >= 0 && m.pct <= 100 })
    return { type: 'numberline', ticks: ticks, marks: marks }
  }

  if (fig.type === 'shape') {
    var shape = (['rectangle', 'square', 'triangle', 'circle'].indexOf(fig.shape) >= 0) ? fig.shape : 'rectangle'
    var w = clampNum(fig.width, 0.1, 100000, 1)
    var h = clampNum(fig.height, 0.1, 100000, w)
    if (shape === 'square' || shape === 'circle') h = w
    var base = Math.max(w, h)
    var maxPx = 180, minPx = 60
    var pw = Math.max(minPx, Math.round(w / base * maxPx))
    var ph = Math.max(minPx, Math.round(h / base * maxPx))
    return {
      type: 'shape', shape: shape,
      w: pw, h: ph,
      width: fig.width, height: fig.height, unit: String(fig.unit || ''),
      showW: fig.width != null, showH: (shape === 'rectangle') && fig.height != null
    }
  }

  return null // image / 未知：外部回退原图
}
