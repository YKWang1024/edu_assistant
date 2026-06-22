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
        // 管理员若还没有家庭码，自动生成一个，保证「看得到家庭码」
        if (res.data.myRole === 'admin' && !res.data.inviteCode) {
          app.callCloudFunction('generateInviteCode', {}, function (r) {
            if (r && r.success) that.setData({ inviteCode: r.data.code })
          })
        }
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
  },

  onRename: function () {
    var that = this
    wx.showModal({
      title: '修改我的称呼',
      editable: true,
      placeholderText: '如 妈妈 / 爸爸 / 家长',
      success: function (m) {
        if (!m.confirm || !(m.content || '').trim()) return
        app.callCloudFunction('setMemberName', { displayName: m.content.trim() }, function (r) {
          if (r && r.success) { wx.showToast({ title: '已修改', icon: 'success' }); that.load() }
          else wx.showToast({ title: (r && r.message) || '修改失败', icon: 'none' })
        })
      }
    })
  }
})
