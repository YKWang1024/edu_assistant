// 打卡页(REQ-023 自定义习惯 + REQ-024 多类型奖励)：习惯列表从 habitDefs 云端加载(不再硬编码),
// 每个习惯 mode='targetTime'(按目标时间早/晚算奖励，如到校/作业/睡觉) 或 'fixed'(打卡即得固定奖励)，
// rewardType='time'|'money'|'points' 决定打卡后钱包记到哪。
var util = require('../../utils/util.js')
var app = getApp()

var REWARD_UNIT = { time: '分钟', money: '元', points: '积分' }

Page({
  data: {
    habits: [],
    loading: true,
    activeHabitId: '',
    currentHabit: null,
    rewardUnit: '分钟',
    timeValue: '',
    todayRecord: null,
    rewardResult: null
  },

  onShow: function () {
    this.loadHabits()
  },

  loadHabits: function () {
    var that = this
    if (!app.globalData.cloudReady) { this.setData({ loading: false }); return }
    app.callCloudFunction('listHabitDefs', {}, function (res) {
      that.setData({ loading: false })
      if (!res || !res.success) {
        if (res && res.code !== 'NO_FAMILY') wx.showToast({ title: (res && res.message) || '加载习惯失败', icon: 'none' })
        return
      }
      var habits = res.data || []
      var keepId = that.data.activeHabitId
      var active = (keepId && habits.some(function (h) { return h._id === keepId })) ? keepId : (habits[0] && habits[0]._id)
      that.setData({ habits: habits })
      if (active) that.selectHabit(active)
    })
  },

  onSwitchTab: function (e) {
    this.selectHabit(e.currentTarget.dataset.id)
  },

  selectHabit: function (id) {
    var habit = this.data.habits.find(function (h) { return h._id === id })
    if (!habit) return
    var now = new Date()
    var currentTime = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes()
    this.setData({
      activeHabitId: id,
      currentHabit: habit,
      rewardUnit: REWARD_UNIT[habit.rewardType] || '分钟',
      timeValue: currentTime,
      rewardResult: null
    })
    this.checkTodayRecord(id)
  },

  onTimeChange: function (e) {
    this.setData({ timeValue: e.detail.value })
  },

  checkTodayRecord: function (habitId) {
    var today = util.getTodayStr()
    var records = util.getRecords('rewardRecords')
    var todayRec = records.find(function (r) { return r.date === today && r.type === habitId })
    this.setData({ todayRecord: todayRec || null })
  },

  onCheckIn: function () {
    var habit = this.data.currentHabit
    if (!habit) return
    if (habit.mode === 'targetTime' && !this.data.timeValue) {
      wx.showToast({ title: '请选择时间', icon: 'none' })
      return
    }

    var result = habit.mode === 'targetTime'
      ? util.calculateHabitReward(habit, this.data.timeValue)
      : util.calculateHabitReward(habit)

    var record = {
      date: util.getTodayStr(),
      time: util.formatTime(new Date()),
      type: habit._id,
      habitId: habit._id,
      habitName: habit.name,
      habitIcon: habit.icon,
      rewardType: habit.rewardType,
      actualTime: habit.mode === 'targetTime' ? this.data.timeValue : '',
      targetTime: habit.mode === 'targetTime' ? habit.targetTime : '',
      reward: result.reward,
      diff: result.diff,
      isEarly: result.isEarly,
      isLate: result.isLate
    }
    util.saveRecord('rewardRecords', record)

    // 同步到云端家庭打卡：在线即发，离线/失败则入队，联网后自动回传。
    // saveCheckin 幂等(按 日期+习惯+孩子 upsert)，重放安全。
    var childName = app.getCurrentChild()
    app.pushOrQueue('saveCheckin', {
      type: record.type,
      habitId: record.habitId,
      habitName: record.habitName,
      habitIcon: record.habitIcon,
      rewardType: record.rewardType,
      actualTime: record.actualTime,
      targetTime: record.targetTime,
      reward: record.reward,
      diff: record.diff,
      isEarly: record.isEarly,
      isLate: record.isLate,
      date: record.date,
      time: record.time,
      childName: childName
    }, { label: '打卡:' + record.habitName, dedupeKey: record.type + '|' + record.date + '|' + childName })

    var unit = REWARD_UNIT[habit.rewardType] || '分钟'
    var msg = ''
    if (result.reward > 0) {
      msg = '太棒了！获得 ' + result.reward + ' ' + unit + '！'
    } else if (result.reward < 0) {
      msg = '超时了，扣除 ' + Math.abs(result.reward) + ' ' + unit
    } else if (result.isOnTime) {
      msg = '准时完成！继续加油！'
    } else {
      msg = '虽然超时了，但不扣哦，明天加油！'
    }

    var that = this
    this.setData({ todayRecord: record })
    wx.showToast({ title: msg, icon: 'none', duration: 2500 })

    // 按奖励类型入对应钱包：time 沿用既有游戏时间钱包；money/points 走新的 rewardWallet
    if (habit.rewardType === 'time') {
      app.addGameMinutes(result.reward, function (totalMinutes) {
        that.setData({ rewardResult: { reward: result.reward, unit: unit, totalMinutes: totalMinutes, msg: msg, isEarly: result.isEarly, isLate: result.isLate } })
      })
    } else {
      app.addRewardWallet(habit.rewardType, result.reward, childName, function (balance) {
        that.setData({ rewardResult: { reward: result.reward, unit: unit, totalMinutes: balance, msg: msg, isEarly: result.isEarly, isLate: result.isLate } })
      })
    }

    this.maybeCelebrateAllDone()
  },

  // 今日全部习惯都打卡完成时庆祝并引导去学习(形成日内循环)
  maybeCelebrateAllDone: function () {
    var habits = this.data.habits
    if (!habits.length) return
    var today = util.getTodayStr()
    var recs = util.getRecords('rewardRecords')
    var doneIds = {}
    recs.forEach(function (r) { if (r.date === today) doneIds[r.type] = true })
    var allDone = habits.every(function (h) { return doneIds[h._id] })
    if (!allDone) return
    var streak = util.calculateStreak(recs)
    setTimeout(function () {
      wx.showModal({
        title: '🎉 今日全部习惯都完成！',
        content: '已连续打卡 ' + streak + ' 天，再来一轮小测赚奖励？',
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
  },

  onManageHabits: function () {
    wx.navigateTo({ url: '/pages/reward/habits' })
  }
})
