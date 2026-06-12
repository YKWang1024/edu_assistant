const app = getApp()

Page({
  data: {
    isRegister: true,
    nickname: '',
    avatarUrl: '',
    loading: false
  },

  onLoad: function () {
    if (app.globalData.isLoggedIn) {
      wx.navigateBack()
    }
  },

  onNicknameInput: function (e) {
    this.setData({ nickname: e.detail.value })
  },

  onChooseAvatar: function () {
    var that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        that.setData({ avatarUrl: res.tempFiles[0].tempFilePath })
      }
    })
  },

  onRegister: function () {
    var nickname = this.data.nickname.trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'register',
      data: {
        nickname: nickname,
        avatarUrl: this.data.avatarUrl
      },
      success: function (res) {
        if (res.result.success) {
          app.saveUserInfo(res.result.userInfo)
          app.saveFamilyId(res.result.familyId)
          wx.showToast({ title: '注册成功', icon: 'success' })
          setTimeout(function () {
            wx.navigateBack()
          }, 1500)
        } else {
          wx.showToast({ title: res.result.message, icon: 'none' })
        }
      },
      fail: function () {
        wx.showToast({ title: '注册失败', icon: 'none' })
      },
      complete: function () {
        this.setData({ loading: false })
      }.bind(this)
    })
  },

  onLogin: function () {
    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'login',
      success: function (res) {
        if (res.result.success && res.result.userInfo) {
          app.saveUserInfo(res.result.userInfo)
          app.saveFamilyId(res.result.userInfo.familyId)
          wx.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(function () {
            wx.navigateBack()
          }, 1500)
        } else {
          wx.showToast({ title: '用户未注册', icon: 'none' })
          this.setData({ isRegister: true })
        }
      }.bind(this),
      fail: function () {
        wx.showToast({ title: '登录失败', icon: 'none' })
      },
      complete: function () {
        this.setData({ loading: false })
      }.bind(this)
    })
  },

  switchMode: function () {
    this.setData({ isRegister: !this.data.isRegister })
  }
})