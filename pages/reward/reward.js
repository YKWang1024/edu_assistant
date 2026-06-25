var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    activeTab: 'school',
    tabs: [
      { key: 'school', name: '到校', icon: '🏫', target: '8:10', rule: '提前1分钟=1分钟游戏时间\n迟到不扣时间' },
      { key: 'homework', name: '作业', icon: '📚', target: '19:30', rule: '提前1分钟=1分钟游戏时间\n超时扣对应时间' },
      { key: 'sleep', name: '睡觉', icon: '🌙', target: '21:00', rule: '提前睡觉加时间(最多10分钟)\n超时不扣时间' }
    ],
    currentTab: null,
    timeValue: '',
    todayRecord: null,
    rewardResult: null
  },

  onLoad: function () {
    var now = new Date()
    var currentTime = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes()
    this.setData({
      currentTab: this.data.tabs[0],
      timeValue: currentTime
    })
    this.checkTodayRecord()
  },

  onSwitchTab: function (e) {
    var key = e.currentTarget.dataset.key
    var tab = this.data.tabs.find(function (t) { return t.key === key })
    var now = new Date()
    var currentTime = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes()
    this.setData({
      activeTab: key,
      currentTab: tab,
      timeValue: currentTime,
      rewardResult: null
    })
    this.checkTodayRecord()
  },

  onTimeChange: function (e) {
    this.setData({ timeValue: e.detail.value })
  },

  checkTodayRecord: function () {
    var today = util.getTodayStr()
    var records = util.getRecords('rewardRecords')
    var type = this.data.activeTab
    var todayRec = records.find(function (r) {
      return r.date === today && r.type === type
    })
    this.setData({ todayRecord: todayRec || null })
  },

  onCheckIn: function () {
    var timeValue = this.data.timeValue
    if (!timeValue) {
      wx.showToast({ title: '请选择时间', icon: 'none' })
      return
    }

    var result = util.calculateReward(this.data.activeTab, timeValue)

    var record = {
      date: util.getTodayStr(),
      time: util.formatTime(new Date()),
      type: this.data.activeTab,
      actualTime: timeValue,
      targetTime: this.data.currentTab.target,
      reward: result.reward,
      diff: result.diff,
      isEarly: result.isEarly,
      isLate: result.isLate
    }
    util.saveRecord('rewardRecords', record)

    // 同步到云端家庭打卡（尽力而为，不影响本地流程与游戏时间钱包）
    if (app.globalData.cloudReady) {
      app.callCloudFunction('saveCheckin', {
        type: record.type,
        actualTime: record.actualTime,
        targetTime: record.targetTime,
        reward: record.reward,
        diff: record.diff,
        isEarly: record.isEarly,
        isLate: record.isLate,
        date: record.date,
        time: record.time
      }, function () {})
    }

    var msg = ''
    if (result.reward > 0) {
      msg = '太棒了！获得 ' + result.reward + ' 分钟游戏时间！'
    } else if (result.reward < 0) {
      msg = '超时了，扣除 ' + Math.abs(result.reward) + ' 分钟游戏时间'
    } else if (result.isOnTime) {
      msg = '准时完成！继续加油！'
    } else {
      msg = '虽然超时了，但不扣时间哦，明天加油！'
    }

    var that = this
    this.setData({ todayRecord: record })
    wx.showToast({ title: msg, icon: 'none', duration: 2500 })

    // 游戏时间入云端钱包，回调里更新显示余额
    app.addGameMinutes(result.reward, function (totalMinutes) {
      that.setData({
        rewardResult: {
          reward: result.reward,
          totalMinutes: totalMinutes,
          msg: msg,
          isEarly: result.isEarly,
          isLate: result.isLate
        }
      })
    })

    this.maybeCelebrateAllDone()
  },

  // 今日三项打卡全完成时庆祝并把孩子引导去学习(形成日内循环)
  maybeCelebrateAllDone: function () {
    var today = util.getTodayStr()
    var recs = util.getRecords('rewardRecords')
    var types = {}
    recs.forEach(function (r) { if (r.date === today) types[r.type] = true })
    if (Object.keys(types).length < 3) return
    var streak = util.calculateStreak(recs)
    setTimeout(function () {
      wx.showModal({
        title: '🎉 今日三项全完成！',
        content: '已连续打卡 ' + streak + ' 天，再来一轮小测赚游戏时间？',
        confirmText: '去小测',
        cancelText: '返回首页',
        success: function (m) {
          if (m.confirm) wx.redirectTo({ url: '/pages/math/math' })
          else wx.switchTab({ url: '/pages/index/index' })
        }
      })
    }, 1200)
  },

  onViewRecords: function () {
    wx.navigateTo({ url: '/pages/reward/record' })
  }
})
