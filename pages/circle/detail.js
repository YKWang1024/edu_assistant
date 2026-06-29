var app = getApp()

// 把时间戳换算成 UTC+8 的 YYYY-MM-DD，与评分 date 字段口径一致(仅在 date 缺失时兜底用)
function dateUTC8(ts) {
  var d = new Date(new Date(ts).getTime() + 8 * 3600 * 1000)
  function p(n) { return (n < 10 ? '0' : '') + n }
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
}

Page({
  data: {
    recipe: null,
    avgScore: 0,
    ratingCount: 0,
    // 评分走势(按日期聚合的平均分，匿名，不展示评分人/评价)
    trend: [],
    hasTrend: false,
    showTrend: false,
    collecting: false
  },

  onLoad: function (options) {
    if (options.recipe) {
      var recipe = JSON.parse(decodeURIComponent(options.recipe))
      this.applyRecipe(recipe)
    }
  },

  applyRecipe: function (recipe) {
    var active = (recipe.ratings || []).filter(function (r) { return !r.deleted })
    var trend = this.buildTrend(active)
    this.setData({
      recipe: recipe,
      avgScore: recipe.avgScore || 0,
      ratingCount: active.length,
      trend: trend,
      hasTrend: trend.length >= 2
    })
  },

  // 把评分按「日期」聚合成每日平均分序列(升序)，最多保留最近 12 个日期。
  // h = 柱高百分比(满分5分对应100%)。匿名——只含 日期/平均分/条数。
  buildTrend: function (active) {
    if (!active || active.length < 2) return []
    var byDate = {}
    active.forEach(function (r) {
      var d = r.date || (r.createdAt ? dateUTC8(r.createdAt) : '')
      if (!d) return
      if (!byDate[d]) byDate[d] = { sum: 0, n: 0 }
      byDate[d].sum += Number(r.score) || 0
      byDate[d].n += 1
    })
    var dates = Object.keys(byDate).sort()
    if (dates.length > 12) dates = dates.slice(dates.length - 12)
    return dates.map(function (d) {
      var g = byDate[d]
      var avg = Math.round((g.sum / g.n) * 10) / 10
      return { date: d, label: d.slice(5), avg: avg, h: Math.max(6, Math.round(avg / 5 * 100)) }
    })
  },

  onToggleTrend: function () {
    if (!this.data.hasTrend) {
      wx.showToast({ title: '评分集中在同一天或不足，暂无走势', icon: 'none' })
      return
    }
    this.setData({ showTrend: !this.data.showTrend })
  },

  // 收藏到我家：把这道公开菜复制成自己家庭的独立菜谱
  onCollectRecipe: function () {
    var that = this
    var recipe = this.data.recipe
    if (!recipe || !recipe._id) { wx.showToast({ title: '菜谱信息缺失', icon: 'none' }); return }
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再收藏', icon: 'none' }); return }
    if (this.data.collecting) return
    this.setData({ collecting: true })
    app.callCloudFunction('collectRecipe', { sourceRecipeId: recipe._id }, function (res) {
      that.setData({ collecting: false })
      if (res && res.success) {
        if (res.data && res.data.duplicated) wx.showToast({ title: '已在你家菜谱中', icon: 'none' })
        else wx.showToast({ title: '已收藏到你家菜谱', icon: 'success' })
      } else {
        wx.showToast({ title: (res && res.message) || '收藏失败', icon: 'none' })
      }
    })
  },

  onPreviewImage: function (e) {
    var recipe = this.data.recipe
    var imgs = (recipe.images && recipe.images.length) ? recipe.images : (recipe.imageUrl ? [recipe.imageUrl] : [])
    var current = e.currentTarget.dataset.src || imgs[0]
    if (imgs.length) wx.previewImage({ current: current, urls: imgs })
  },

  onShareAppMessage: function () {
    // 分享卡片只带展示所需字段，去掉评分明细等(防 PII 二次扩散，也避免 path 过长)
    var r = this.data.recipe || {}
    var slim = {
      _id: r._id, name: r.name, category: r.category,
      images: r.images, imageUrl: r.imageUrl,
      ingredients: r.ingredients, steps: r.steps, tags: r.tags,
      avgScore: r.avgScore
    }
    return {
      title: (r.name || '菜谱') + ' - 来自菜友圈',
      path: '/pages/circle/detail?recipe=' + encodeURIComponent(JSON.stringify(slim))
    }
  }
})
