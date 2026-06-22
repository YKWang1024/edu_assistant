const app = getApp()

Page({
  data: {
    recipes: [],
    loading: true,
    refreshing: false
  },

  onLoad: function () {
    this.loadFriendRecipes()
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
        if (res.result.success) {
          this.setData({ recipes: res.result.recipes })
        } else {
          wx.showToast({ title: res.result.message, icon: 'none' })
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