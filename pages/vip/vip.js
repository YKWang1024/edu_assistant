Page({
  data: {
    appName: '家庭小助手',
    version: '1.0.0'
  },

  onViewWrong: function () {
    // 统一错题本：拍照错题 + 语数英小测错题都在这里
    wx.navigateTo({ url: '/pages/exam/exam' })
  },

  onGoFamily: function () {
    wx.navigateTo({ url: '/pages/family/manage' })
  },

  onGoSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' })
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
