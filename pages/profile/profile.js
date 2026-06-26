var app = getApp()

Page({
  data: {
    nickname: '',
    avatarUrl: '',   // 当前展示(原有 fileID/网络图 或 新选本地图)
    avatarLocal: '', // 本次新选的本地临时头像(需上传)
    saving: false
  },

  onLoad: function () {
    var ui = app.globalData.userInfo || {}
    this.setData({ nickname: ui.nickname || '', avatarUrl: ui.avatarUrl || '' })
  },

  // 微信头像选择器
  onChooseAvatar: function (e) {
    var url = e.detail.avatarUrl
    if (url) this.setData({ avatarLocal: url, avatarUrl: url })
  },

  onNicknameInput: function (e) { this.setData({ nickname: e.detail.value }) },

  onSave: function () {
    var that = this
    var nickname = (this.data.nickname || '').trim()
    if (!nickname) { wx.showToast({ title: '请输入昵称', icon: 'none' }); return }
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再保存', icon: 'none' }); return }
    this.setData({ saving: true })

    function doUpdate(avatarUrl) {
      app.callCloudFunction('updateProfile', { nickname: nickname, avatarUrl: avatarUrl || '' }, function (res) {
        that.setData({ saving: false })
        if (res && res.success) {
          if (res.data && res.data.userInfo) app.saveUserInfo(res.data.userInfo)
          wx.showToast({ title: '已保存', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 1000)
        } else {
          wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
        }
      })
    }

    // 选了新头像 → 先上传云存储拿 fileID；否则沿用原头像
    if (this.data.avatarLocal) {
      var cloudPath = 'avatar/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '.jpg'
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: this.data.avatarLocal,
        success: function (r) { doUpdate(r.fileID) },
        fail: function () { wx.showToast({ title: '头像上传失败，仅保存昵称', icon: 'none' }); doUpdate('') }
      })
    } else {
      doUpdate(this.data.avatarUrl)
    }
  }
})
