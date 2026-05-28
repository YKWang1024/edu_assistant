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
    var totalMinutes = app.addGameMinutes(result.reward)

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

    this.setData({
      rewardResult: {
        reward: result.reward,
        totalMinutes: totalMinutes,
        msg: msg,
        isEarly: result.isEarly,
        isLate: result.isLate
      },
      todayRecord: record
    })

    wx.showToast({ title: msg, icon: 'none', duration: 2500 })
  },

  onViewRecords: function () {
    wx.navigateTo({ url: '/pages/reward/record' })
  }
})
