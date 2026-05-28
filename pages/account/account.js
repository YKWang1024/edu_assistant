var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    gameMinutes: 0,
    todayEarned: 0,
    todayDeducted: 0,
    weekEarned: 0,
    recentRecords: [],
    typeNames: {
      school: '到校',
      homework: '作业',
      sleep: '睡觉'
    },
    typeIcons: {
      school: '🏫',
      homework: '📚',
      sleep: '🌙'
    }
  },

  onShow: function () {
    this.loadData()
  },

  loadData: function () {
    var gameMinutes = app.globalData.gameMinutes
    var today = util.getTodayStr()
    var records = util.getRecords('rewardRecords')
    this.processData(gameMinutes, records, today)
  },

  processData: function (gameMinutes, records, today) {
    var todayEarned = 0
    var todayDeducted = 0
    var weekEarned = 0

    var now = new Date()
    var weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    var weekStartStr = util.formatDate(weekStart)

    records.forEach(function (r) {
      if (r.date === today) {
        if (r.reward > 0) todayEarned += r.reward
        if (r.reward < 0) todayDeducted += Math.abs(r.reward)
      }
      if (r.date >= weekStartStr) {
        if (r.reward > 0) weekEarned += r.reward
        if (r.reward < 0) weekEarned += r.reward
      }
    })

    var recentRecords = records.slice(0, 20)

    this.setData({
      gameMinutes: gameMinutes,
      todayEarned: todayEarned,
      todayDeducted: todayDeducted,
      weekEarned: weekEarned,
      recentRecords: recentRecords
    })
  },

  onUseTime: function () {
    var that = this
    if (this.data.gameMinutes <= 0) {
      wx.showToast({ title: '没有可用游戏时间', icon: 'none' })
      return
    }
    wx.showModal({
      title: '使用游戏时间',
      content: '当前有 ' + that.data.gameMinutes + ' 分钟游戏时间，使用后将从账户中扣除',
      editable: true,
      placeholderText: '请输入使用分钟数',
      success: function (res) {
        if (res.confirm && res.content) {
          var minutes = parseInt(res.content)
          if (isNaN(minutes) || minutes <= 0) {
            wx.showToast({ title: '请输入有效分钟数', icon: 'none' })
            return
          }
          if (minutes > that.data.gameMinutes) {
            wx.showToast({ title: '游戏时间不足', icon: 'none' })
            return
          }
          app.addGameMinutes(-minutes)
          that.loadData()
          wx.showToast({ title: '已使用 ' + minutes + ' 分钟', icon: 'success' })
        }
      }
    })
  }
})
