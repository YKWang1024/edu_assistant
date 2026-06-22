var app = getApp()
var util = require('../../utils/util.js')

Page({
  data: {
    gameMinutes: 0,
    todayChecked: {
      school: false,
      homework: false,
      sleep: false
    }
  },

  onShow: function () {
    var that = this
    this.setData({ gameMinutes: app.globalData.gameMinutes })
    app.refreshGameTime(function (balance) { that.setData({ gameMinutes: balance }) })
    this.checkTodayStatus()
  },

  checkTodayStatus: function () {
    var that = this
    var today = util.getTodayStr()
    function applyLocal() {
      var records = util.getRecords('rewardRecords')
      var checked = { school: false, homework: false, sleep: false }
      records.forEach(function (r) { if (r.date === today) checked[r.type] = true })
      that.setData({ todayChecked: checked })
    }
    if (!app.globalData.cloudReady) { applyLocal(); return }
    app.callCloudFunction('listCheckins', {}, function (res) {
      if (res && res.success) {
        var checked = { school: false, homework: false, sleep: false }
        ;(res.data || []).forEach(function (r) { if (r.date === today) checked[r.type] = true })
        that.setData({ todayChecked: checked })
      } else {
        applyLocal()
      }
    })
  },

  onTapMath: function () {
    wx.navigateTo({ url: '/pages/math/math' })
  },

  onTapPinyin: function () {
    wx.navigateTo({ url: '/pages/pinyin/pinyin' })
  },

  onTapEnglish: function () {
    wx.navigateTo({ url: '/pages/english/english' })
  },

  onTapReward: function () {
    wx.navigateTo({ url: '/pages/reward/reward' })
  },

  onTapRecipe: function () {
    wx.switchTab({ url: '/pages/recipe/recipe' })
  },

  onTapAccount: function () {
    wx.switchTab({ url: '/pages/account/account' })
  },

  onTapWrong: function () {
    wx.navigateTo({ url: '/pages/wrong/wrong' })
  },

  onTapExam: function () {
    wx.navigateTo({ url: '/pages/exam/exam' })
  }
})
