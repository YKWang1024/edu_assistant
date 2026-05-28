Page({
  data: {
    appName: '家庭小助手',
    version: '1.0.0'
  },

  onViewWrong: function () {
    wx.navigateTo({ url: '/pages/wrong/wrong' })
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
