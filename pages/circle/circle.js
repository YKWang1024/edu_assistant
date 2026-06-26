const app = getApp()
var config = require('../../config/ai.js')

Page({
  data: {
    recipes: [],
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
        that.setData({ recipes: res.data || res.recipes || [] })
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
