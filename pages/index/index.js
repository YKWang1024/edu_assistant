var app = getApp()
var util = require('../../utils/util.js')

Page({
  data: {
    childName: '宝贝',
    level: 1,
    gameMinutes: 0,
    streak: 0,
    doneCount: 0,
    progressPct: 0,
    todayChecked: {
      school: false,
      homework: false,
      sleep: false
    }
  },

  onShow: function () {
    var that = this
    // 先用缓存值显示，避免首屏闪现 0
    var cached = app.globalData.gameMinutes || 0
    this.setData({
      childName: app.getCurrentChild(),
      gameMinutes: cached,
      level: this.calcLevel(cached)
    })
    app.refreshGameTime(function (balance) {
      that.setData({ gameMinutes: balance, level: that.calcLevel(balance) })
    })
    this.checkTodayStatus()
  },

  // 由成长值(累计游戏时间)粗略折算等级，纯展示用
  calcLevel: function (val) {
    return Math.max(1, Math.floor((val || 0) / 50) + 1)
  },

  applyChecked: function (checked, records) {
    var done = (checked.school ? 1 : 0) + (checked.homework ? 1 : 0) + (checked.sleep ? 1 : 0)
    this.setData({
      todayChecked: checked,
      doneCount: done,
      progressPct: Math.round(done / 3 * 100),
      streak: util.calculateStreak(records || [])
    })
  },

  checkTodayStatus: function () {
    var that = this
    var today = util.getTodayStr()
    function applyLocal() {
      var records = util.getRecords('rewardRecords')
      var checked = { school: false, homework: false, sleep: false }
      records.forEach(function (r) { if (r.date === today) checked[r.type] = true })
      that.applyChecked(checked, records)
    }
    if (!app.globalData.cloudReady) { applyLocal(); return }
    app.callCloudFunction('listCheckins', {}, function (res) {
      if (res && res.success) {
        var records = res.data || []
        var checked = { school: false, homework: false, sleep: false }
        records.forEach(function (r) { if (r.date === today) checked[r.type] = true })
        that.applyChecked(checked, records)
      } else {
        applyLocal()
      }
    })
  },

  // 今日一键小测：随机一科，降低每日启动摩擦
  onTapDailyQuiz: function () {
    var subs = ['/pages/math/math', '/pages/pinyin/pinyin', '/pages/english/english']
    wx.navigateTo({ url: subs[Math.floor(Math.random() * subs.length)] })
  },

  onTapFamily: function () {
    wx.navigateTo({ url: '/pages/family/manage' })
  },

  onTapAI: function () {
    wx.switchTab({ url: '/pages/ai/ai' })
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
    // 统一错题本(拍照错题 + 语数英小测错题)
    wx.navigateTo({ url: '/pages/exam/exam' })
  },

  onTapExam: function () {
    // 直接进入拍照录题(快速添加)
    wx.navigateTo({ url: '/pages/exam/capture' })
  }
})
