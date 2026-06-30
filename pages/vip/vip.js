var app = getApp()
var SUPER_OPENID = 'oSnsZ7e4ja7cq2Eq5_u3hQKx3HMo' // 超级用户(系统菜谱管理) REQ-022

Page({
  data: {
    appName: '宝贝成长助手',
    version: '1.0.0',
    childName: '宝贝',
    level: 1,
    gameMinutes: 0,
    isSuper: false
  },

  onShow: function () {
    var that = this
    var cached = app.globalData.gameMinutes || 0
    var ui = app.globalData.userInfo || {}
    this.setData({
      childName: app.getCurrentChild(),
      gameMinutes: cached,
      level: Math.max(1, Math.floor(cached / 50) + 1),
      isSuper: ui.openid === SUPER_OPENID
    })
    app.refreshGameTime(function (balance) {
      that.setData({ gameMinutes: balance, level: Math.max(1, Math.floor((balance || 0) / 50) + 1) })
    })
  },

  // 系统菜谱管理(仅超级用户) REQ-022
  onGoSysRecipes: function () {
    wx.navigateTo({ url: '/pages/recipe/sysrecipes?mode=manage' })
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

  onGoProfile: function () {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  // 分享小程序给好友：path 指向主页，好友打开后会自动创建自己的家庭
  onShareAppMessage: function () {
    return {
      title: '宝贝成长助手 · 一起记录孩子的学习和家庭菜谱',
      path: '/pages/index/index'
    }
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
