const app = getApp()

Page({
  data: {
    recipes: [],
    wikis: [],
    loading: true,
    refreshing: false
  },

  onLoad: function () {
    this.loadFriendRecipes()
    this.loadWikis()
  },

  loadWikis: function () {
    var that = this
    if (!app.globalData.cloudReady) return
    wx.cloud.callFunction({
      name: 'listWiki',
      data: { scope: 'public' },
      success: function (res) {
        if (res.result && res.result.success) that.setData({ wikis: res.result.data || [] })
      }
    })
  },

  onGoWiki: function () {
    wx.navigateTo({ url: '/pages/wiki/wiki' })
  },

  loadFriendRecipes: function () {
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getFriendRecipes',
      success: function (res) {
        if (res.result && res.result.success) {
          // getFriendRecipes 返回的是 data 字段（旧代码误读 recipes，导致永远为空）
          var list = res.result.data || res.result.recipes || []
          this.setData({ recipes: list })
        } else {
          wx.showToast({ title: (res.result && res.result.message) || '获取失败', icon: 'none' })
        }
      }.bind(this),
      fail: function () {
        wx.showToast({ title: '获取失败', icon: 'none' })
      },
      complete: function () {
        this.setData({ loading: false, refreshing: false })
      }.bind(this)
    })
  },

  onRefresh: function () {
    this.setData({ refreshing: true })
    this.loadFriendRecipes()
    this.loadWikis()
  },

  onViewRecipe: function (e) {
    var recipe = e.currentTarget.dataset.recipe
    wx.navigateTo({
      url: '/pages/circle/detail?recipe=' + encodeURIComponent(JSON.stringify(recipe))
    })
  },

  onShareRecipe: function (e) {
    var recipe = e.currentTarget.dataset.recipe
    wx.showModal({
      title: '分享到菜友圈',
      content: '确定要将这道菜分享到菜友圈吗？',
      success: function (res) {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'shareRecipe',
            data: {
              recipeId: recipe._id,
              shareMessage: ''
            },
            success: function (res) {
              if (res.result.success) {
                wx.showToast({ title: '分享成功', icon: 'success' })
              } else {
                wx.showToast({ title: res.result.message, icon: 'none' })
              }
            },
            fail: function () {
              wx.showToast({ title: '分享失败', icon: 'none' })
            }
          })
        }
      }
    })
  }
})