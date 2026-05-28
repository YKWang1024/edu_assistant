var util = require('../../utils/util.js')

Page({
  data: {
    records: [],
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
    var records = util.getRecords('rewardRecords')
    this.setData({ records: records })
  }
})
