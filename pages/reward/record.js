var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    records: [],
    offline: false,
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
    this.loadRecords()
  },

  loadRecords: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      this.setData({ records: util.getRecords('rewardRecords'), offline: true })
      return
    }
    this.maybeMigrate(function () {
      app.callCloudFunction('listCheckins', {}, function (res) {
        if (res && res.success) {
          that.setData({ records: res.data || [], offline: false })
        } else {
          that.setData({ records: util.getRecords('rewardRecords'), offline: true })
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
