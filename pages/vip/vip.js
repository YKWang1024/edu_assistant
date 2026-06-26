var app = getApp()

Page({
  data: {
    appName: '宝贝成长助手',
    version: '1.0.0',
    childName: '宝贝',
    level: 1,
    gameMinutes: 0
  },

  onShow: function () {
    var that = this
    var cached = app.globalData.gameMinutes || 0
    this.setData({
      childName: app.getCurrentChild(),
      gameMinutes: cached,
      level: Math.max(1, Math.floor(cached / 50) + 1)
    })
    app.refreshGameTime(function (balance) {
      that.setData({ gameMinutes: balance, level: Math.max(1, Math.floor((balance || 0) / 50) + 1) })
    })
  },

  onViewWrong: function () {
    // 统一错题本：拍照错题 + 语数英小测错题都在这里
    wx.navigateTo({ url: '/pages/exam/exam' })
  },

  onGoFamily: function () {
    wx.navigateTo({ url: '/pages/family/manage' })
  },

  onGoRecipe: function () {
    wx.switchTab({ url: '/pages/recipe/recipe' })
  },

  onGoAI: function () {
    wx.navigateTo({ url: '/pages/ai/ai' })
  },

  onClearData: function () {
    wx.showModal({
      title: '清除数据',
      content: '确定要清除所有本地数据吗？此操作不可恢复！',
      confirmColor: '#FF6B6B',
      success: function (res) {
        if (res.confirm) {
          try {
            wx.clearStorageSync()
            wx.showToast({ title: '数据已清除', icon: 'success' })
          } catch (e) {
            wx.showToast({ title: '清除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
