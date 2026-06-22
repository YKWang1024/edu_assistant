var app = getApp()

Page({
  data: {
    loading: true,
    needLogin: false,
    familyId: '',
    myRole: '',
    isAdmin: false,
    members: [],
    inviteCode: ''
  },

  onShow: function () {
    this.load()
  },

  load: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      that.setData({ loading: false })
      wx.showToast({ title: '云开发未就绪，请稍后重试', icon: 'none' })
      return
    }
    app.callCloudFunction('getFamilyInfo', {}, function (res) {
      if (res && res.success) {
        that.setData({
          loading: false,
          needLogin: false,
          familyId: res.data.familyId,
          myRole: res.data.myRole,
          isAdmin: res.data.myRole === 'admin',
          members: res.data.members || [],
          inviteCode: res.data.inviteCode || ''
        })
      } else if (res && res.code === 'NO_FAMILY') {
        that.setData({ loading: false, needLogin: true })
      } else {
        that.setData({ loading: false })
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' })
      }
    })
  },

  onGoAuth: function () {
    wx.navigateTo({ url: '/pages/auth/auth' })
  },

  onGenerateCode: function () {
    var that = this
    wx.showLoading({ title: '生成中…' })
    app.callCloudFunction('generateInviteCode', {}, function (res) {
      wx.hideLoading()
      if (res && res.success) {
        that.setData({ inviteCode: res.data.code })
        wx.showToast({ title: '已生成', icon: 'success' })
      } else {
        wx.showToast({ title: (res && res.message) || '生成失败', icon: 'none' })
      }
    })
  },

  onCopyCode: function () {
    if (!this.data.inviteCode) {
      wx.showToast({ title: '请先生成邀请码', icon: 'none' })
      return
    }
    wx.setClipboardData({ data: this.data.inviteCode })
  },

  onShareAppMessage: function () {
    var code = this.data.inviteCode
    var familyId = this.data.familyId
    var path = '/pages/family/join?familyId=' + familyId + (code ? ('&code=' + code) : '')
    return {
      title: '邀请你加入我们的家庭 👨‍👩‍👧',
      path: path
    }
  },

  onGoJoin: function () {
    wx.navigateTo({ url: '/pages/family/join' })
  }
})
