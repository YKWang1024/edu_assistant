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
    this.setData({
      gameMinutes: app.globalData.gameMinutes
    })
    this.checkTodayStatus()
  },

  checkTodayStatus: function () {
    var today = util.getTodayStr()
    var records = util.getRecords('rewardRecords')
    var checked = { school: false, homework: false, sleep: false }
    records.forEach(function (r) {
      if (r.date === today) {
        checked[r.type] = true
      }
    })
    this.setData({ todayChecked: checked })
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
  }
})
