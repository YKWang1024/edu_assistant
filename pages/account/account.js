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
    var that = this
    // 余额 + 今日/本周获得（云端权威，离线回退缓存）
    app.refreshGameTime(function (balance, stats) {
      that.setData({
        gameMinutes: balance,
        todayEarned: stats ? stats.todayEarned : 0,
        todayDeducted: stats ? stats.todayDeducted : 0,
        weekEarned: stats ? stats.weekEarned : 0
      })
    })
    // 最近打卡记录
    if (app.globalData.cloudReady) {
      app.callCloudFunction('listCheckins', { limit: 20 }, function (res) {
        if (res && res.success) that.setData({ recentRecords: (res.data || []).slice(0, 20) })
        else that.setData({ recentRecords: util.getRecords('rewardRecords').slice(0, 20) })
      })
    } else {
      this.setData({ recentRecords: util.getRecords('rewardRecords').slice(0, 20) })
    }
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
        if (!res.confirm || !res.content) return
        var minutes = parseInt(res.content)
        if (isNaN(minutes) || minutes <= 0) {
          wx.showToast({ title: '请输入有效分钟数', icon: 'none' })
          return
        }
        if (minutes > that.data.gameMinutes) {
          wx.showToast({ title: '游戏时间不足', icon: 'none' })
          return
        }
        if (!app.globalData.cloudReady) {
          wx.showToast({ title: '请联网后再使用', icon: 'none' })
          return
        }
        app.callCloudFunction('spendGameTime', { minutes: minutes }, function (r) {
          if (r && r.success) {
            app.saveGameMinutes(r.data.balance)
            that.loadData()
            wx.showToast({ title: '已使用 ' + minutes + ' 分钟', icon: 'success' })
          } else {
            wx.showToast({ title: (r && r.message) || '扣减失败', icon: 'none' })
          }
        })
      }
    })
  }
})
