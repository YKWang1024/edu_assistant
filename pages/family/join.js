var app = getApp()

Page({
  data: {
    code: '',
    displayName: '',
    joining: false,
    fromCard: false,
    cardFamilyId: ''
  },

  onLoad: function (options) {
    var patch = {}
    if (options.code) patch.code = decodeURIComponent(options.code)
    if (options.familyId) {
      patch.fromCard = true
      patch.cardFamilyId = decodeURIComponent(options.familyId)
    }
    var ui = app.globalData.userInfo
    if (ui && ui.nickname) patch.displayName = ui.nickname
    this.setData(patch)
  },

  onCodeInput: function (e) {
    this.setData({ code: e.detail.value })
  },

  onNameInput: function (e) {
    this.setData({ displayName: e.detail.value })
  },

  onJoin: function () {
    var displayName = (this.data.displayName || '').trim()
    if (this.data.fromCard && this.data.cardFamilyId) {
      this.doJoin('joinFamilyById', { familyId: this.data.cardFamilyId, displayName: displayName })
    } else {
      var code = (this.data.code || '').trim()
      if (!code) { wx.showToast({ title: '请输入邀请码', icon: 'none' }); return }
      this.doJoin('joinFamilyByCode', { code: code, displayName: displayName })
    }
  },

  doJoin: function (fn, payload, force) {
    var that = this
    if (!app.globalData.cloudReady) {
      wx.showToast({ title: '云开发未就绪，请稍后重试', icon: 'none' })
      return
    }
    if (force) payload.force = true
    that.setData({ joining: true })
    app.callCloudFunction(fn, payload, function (res) {
      if (res && res.success) {
        app.saveFamilyId(res.data.familyId)
        // 刷新本地 userInfo，确保 isLoggedIn 与 familyId 同步
        app.callCloudFunction('login', {}, function (lr) {
          if (lr && lr.success && lr.userInfo) app.saveUserInfo(lr.userInfo)
          that.setData({ joining: false })
          wx.showToast({ title: '已加入家庭', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 1200)
        })
      } else if (res && res.code === 'ALREADY_IN_FAMILY') {
        that.setData({ joining: false })
        wx.showModal({
          title: '切换家庭',
          content: '你已在一个家庭中，加入新家庭将退出当前家庭，确定？',
          success: function (m) { if (m.confirm) that.doJoin(fn, payload, true) }
        })
      } else {
        that.setData({ joining: false })
        wx.showToast({ title: (res && res.message) || '加入失败', icon: 'none' })
      }
    })
  }
})
