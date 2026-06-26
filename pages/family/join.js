var app = getApp()

Page({
  data: {
    code: '',
    displayName: '',
    joining: false,
    fromCard: false,
    cardFamilyId: '',
    checking: false
  },

  onLoad: function (options) {
    var patch = {}
    if (options.code) patch.code = decodeURIComponent(options.code)
    if (options.familyId) {
      patch.fromCard = true
      patch.cardFamilyId = decodeURIComponent(options.familyId)
      patch.checking = true // 卡片进入：先确认是否已在该家庭
    }
    var ui = app.globalData.userInfo
    if (ui && ui.nickname) patch.displayName = ui.nickname
    this.setData(patch)
    if (patch.fromCard) this.checkMembership()
  },

  // 已在该家庭 → 直接进主页；不在 → 显示加入表单
  checkMembership: function () {
    var that = this
    if (!app.globalData.cloudReady) { that.setData({ checking: false }); return }
    app.callCloudFunction('getMyFamilies', {}, function (res) {
      var inIt = false
      if (res && res.success && res.data && res.data.families) {
        inIt = res.data.families.some(function (f) { return f.familyId === that.data.cardFamilyId })
      }
      if (inIt) {
        wx.showToast({ title: '你已在该家庭，正在进入…', icon: 'none' })
        setTimeout(function () { wx.switchTab({ url: '/pages/index/index' }) }, 900)
      } else {
        that.setData({ checking: false })
      }
    })
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

  doJoin: function (fn, payload) {
    var that = this
    if (!app.globalData.cloudReady) {
      wx.showToast({ title: '云开发未就绪，请稍后重试', icon: 'none' })
      return
    }
    that.setData({ joining: true })
    // 多家庭：加入是「追加」，不再退出原家庭，故无需 force/二次确认
    app.callCloudFunction(fn, payload, function (res) {
      if (res && res.success) {
        app.saveFamilyId(res.data.familyId)
        // 刷新本地 userInfo 与家庭态，确保当前家庭/角色同步
        app.callCloudFunction('login', {}, function (lr) {
          if (lr && lr.success && lr.userInfo) app.saveUserInfo(lr.userInfo)
          app.refreshFamily(function () {})
          that.setData({ joining: false })
          wx.showToast({ title: res.message || '已加入家庭', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 1200)
        })
      } else {
        that.setData({ joining: false })
        wx.showToast({ title: (res && res.message) || '加入失败', icon: 'none' })
      }
    })
  }
})
