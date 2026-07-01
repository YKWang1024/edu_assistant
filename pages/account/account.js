var util = require('../../utils/util.js')
var app = getApp()

// 旧版硬编码习惯的图标/名称(兼容 REQ-023 改造前的历史记录)
var LEGACY_ICONS = { school: '🏫', homework: '📚', sleep: '🌙' }
var LEGACY_NAMES = { school: '到校', homework: '作业', sleep: '睡觉' }
var REWARD_UNIT = { time: '分钟', money: '元', points: '积分' }

function decorate(records) {
  return (records || []).map(function (r) {
    return Object.assign({}, r, {
      displayIcon: r.habitIcon || LEGACY_ICONS[r.type] || '⭐',
      displayName: r.habitName || LEGACY_NAMES[r.type] || r.type,
      unit: REWARD_UNIT[r.rewardType] || '分钟'
    })
  })
}

Page({
  data: {
    gameMinutes: 0,
    todayEarned: 0,
    todayDeducted: 0,
    weekEarned: 0,
    moneyBalance: 0,     // REQ-024 零花钱余额
    pointsBalance: 0,    // REQ-024/025 积分余额
    // REQ-003 学习互动统计(练习互动次数 + 练习停留时长)
    usageTodayTaps: 0,
    usageTodayDwellMin: 0,
    usageDays: [],
    recentRecords: []
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
        if (res && res.success) that.setData({ recentRecords: decorate((res.data || []).slice(0, 20)) })
        else that.setData({ recentRecords: decorate(util.getRecords('rewardRecords').slice(0, 20)) })
      })
    } else {
      this.setData({ recentRecords: decorate(util.getRecords('rewardRecords').slice(0, 20)) })
    }
    // REQ-024 零花钱/积分余额
    app.getRewardWallet('money', app.getCurrentChild(), function (balance) { that.setData({ moneyBalance: balance }) })
    app.getRewardWallet('points', app.getCurrentChild(), function (balance) { that.setData({ pointsBalance: balance }) })
    // REQ-003 学习互动统计(当前小孩近7天)
    this.loadUsageStats()
  },

  onGoMall: function () {
    wx.navigateTo({ url: '/pages/reward/mall' })
  },

  loadUsageStats: function () {
    var that = this
    if (!app.globalData.cloudReady) return
    app.getUsageStats(app.getCurrentChild(), 7, function (data) {
      if (!data) return
      var todayDwellMin = Math.floor(((data.today && data.today.dwellSec) || 0) / 60)
      var days = (data.list || []).map(function (d) {
        return { date: d.date, taps: d.taps || 0, dwellMin: Math.floor((d.dwellSec || 0) / 60) }
      })
      that.setData({
        usageTodayTaps: (data.today && data.today.taps) || 0,
        usageTodayDwellMin: todayDwellMin,
        usageDays: days
      })
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
