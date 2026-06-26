const app = getApp()
var config = require('../../config/ai.js')

Page({
  data: {
    recipes: [],       // 经排序/筛选后展示用
    recipesAll: [],    // 原始全量
    sortMode: 'latest', // latest | score (REQ-009 按评分排序)
    minScore: 0,        // 0 | 4 (REQ-009 按评分筛选)
    wikis: [],
    loading: true,
    refreshing: false
  },

  // 每次进入菜友圈都刷新，能及时看到新分享的菜/心得
  onShow: function () {
    this.loadFriendRecipes()
    this.loadWikis()
  },

  loadFriendRecipes: function () {
    var that = this
    if (!app.globalData.cloudReady) { that.setData({ loading: false }); return }
    if (!that.data.refreshing) that.setData({ loading: true })
    // 菜友圈是公共池：getFriendRecipes 以管理员身份读所有 isPublic 菜谱，不需登录态
    app.callCloudFunction('getFriendRecipes', {}, function (res) {
      that.setData({ loading: false, refreshing: false })
      if (res && res.success) {
        that.setData({ recipesAll: res.data || res.recipes || [] })
        that.applySort()
      } else {
        var msg = (res && res.message) || '获取失败'
        if (config.DEBUG) {
          wx.showModal({ title: '菜友圈加载失败(调试)', content: msg + (res && res.error ? ('\n' + res.error) : ''), showCancel: false })
        } else {
          wx.showToast({ title: msg, icon: 'none' })
        }
      }
    })
  },

  loadWikis: function () {
    var that = this
    if (!app.globalData.cloudReady) return
    app.callCloudFunction('listWiki', { scope: 'public' }, function (res) {
      if (res && res.success) that.setData({ wikis: res.data || [] })
    })
  },

  // 按评分排序 / 按评分筛选(REQ-009)；活跃评分数也在此一并算准(排除已删)
  applySort: function () {
    var sortMode = this.data.sortMode
    var minScore = this.data.minScore
    var list = (this.data.recipesAll || []).map(function (r) {
      var active = (r.ratings || []).filter(function (x) { return !x.deleted })
      return Object.assign({}, r, { ratingCount: active.length, _avg: Number(r.avgScore) || 0 })
    })
    if (minScore > 0) list = list.filter(function (r) { return r._avg >= minScore })
    if (sortMode === 'score') {
      list.sort(function (a, b) { return b._avg - a._avg })
    }
    // latest: 维持后端 sharedAt desc 原序
    this.setData({ recipes: list })
  },

  onSetSort: function (e) {
    var mode = e.currentTarget.dataset.mode
    if (mode === this.data.sortMode) return
    this.setData({ sortMode: mode })
    this.applySort()
  },

  onToggleFilter: function () {
    this.setData({ minScore: this.data.minScore > 0 ? 0 : 4 })
    this.applySort()
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    var that = this
    this.setData({ refreshing: true })
    this.loadFriendRecipes()
    this.loadWikis()
    setTimeout(function () { wx.stopPullDownRefresh() }, 600)
  },

  onViewRecipe: function (e) {
    var recipe = e.currentTarget.dataset.recipe
    wx.navigateTo({
      url: '/pages/circle/detail?recipe=' + encodeURIComponent(JSON.stringify(recipe))
    })
  },

  onGoWiki: function () {
    wx.navigateTo({ url: '/pages/wiki/wiki' })
  },

  onGoRecipe: function () {
    wx.switchTab({ url: '/pages/recipe/recipe' })
  }
})
