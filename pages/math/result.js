Page({
  data: {
    correct: 0,
    total: 5,
    time: 0,
    scoreLevel: '',
    scoreEmoji: '',
    scoreMsg: ''
  },

  onLoad: function (options) {
    var correct = parseInt(options.correct) || 0
    var total = parseInt(options.total) || 5
    var time = parseInt(options.time) || 0

    var level = ''
    var emoji = ''
    var msg = ''

    if (correct === total) {
      level = 'perfect'
      emoji = '🎉'
      msg = '太棒了！全对！'
    } else if (correct >= total * 0.8) {
      level = 'great'
      emoji = '👍'
      msg = '非常棒！继续加油！'
    } else if (correct >= total * 0.6) {
      level = 'good'
      emoji = '💪'
      msg = '还不错，再练练！'
    } else {
      level = 'tryagain'
      emoji = '😊'
      msg = '别灰心，多练习就会进步！'
    }

    this.setData({
      correct: correct,
      total: total,
      time: time,
      scoreLevel: level,
      scoreEmoji: emoji,
      scoreMsg: msg
    })
  },

  onTapRestart: function () {
    wx.redirectTo({ url: '/pages/math/math' })
  },

  onTapBack: function () {
    wx.navigateBack({ delta: 1 })
  }
})
