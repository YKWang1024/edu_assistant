var util = require('../../utils/util.js')
var app = getApp()

// 旧版硬编码习惯的图标/名称(兼容 REQ-023 改造前的历史记录，那些记录没有 habitIcon/habitName 快照)
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
    records: [],
    offline: false
  },

  onShow: function () {
    this.loadRecords()
  },

  loadRecords: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      this.setData({ records: decorate(util.getRecords('rewardRecords')), offline: true })
      return
    }
    this.maybeMigrate(function () {
      app.callCloudFunction('listCheckins', {}, function (res) {
        if (res && res.success) {
          that.setData({ records: decorate(res.data || []), offline: false })
        } else {
          that.setData({ records: decorate(util.getRecords('rewardRecords')), offline: true })
        }
      })
    })
  },

  // 首次联网把本地旧打卡记录导入云端家庭，仅一次
  maybeMigrate: function (done) {
    var migrated = false
    try { migrated = wx.getStorageSync('migratedCheckins') } catch (e) {}
    if (migrated) { done(); return }

    var local = util.getRecords('rewardRecords')
    if (!local.length) {
      try { wx.setStorageSync('migratedCheckins', true) } catch (e) {}
      done()
      return
    }

    var i = 0
    function next() {
      if (i >= local.length) {
        try { wx.setStorageSync('migratedCheckins', true) } catch (e) {}
        done()
        return
      }
      var r = local[i]
      app.callCloudFunction('saveCheckin', {
        type: r.type,
        actualTime: r.actualTime,
        targetTime: r.targetTime,
        reward: r.reward,
        diff: r.diff,
        isEarly: r.isEarly,
        isLate: r.isLate,
        date: r.date,
        time: r.time
      }, function () { i++; next() })
    }
    next()
  }
})
