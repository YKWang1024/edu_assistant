var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    correct: 0,
    total: 5,
    time: 0,
    scoreLevel: '',
    scoreEmoji: '',
    scoreMsg: '',
    reward: 0,
    gameMinutes: 0
  },

  onLoad: function (options) {
    var that = this
    var correct = parseInt(options.correct) || 0
    var total = parseInt(options.total) || 5
    var time = parseInt(options.time) || 0

    // 学习即奖励：答得越好，赚到越多游戏时间（每日打开的核心动机）
    var reward = util.quizRewardMinutes(correct, total)
    this.setData({ reward: reward, gameMinutes: app.globalData.gameMinutes || 0 })
    if (reward > 0) {
      app.addGameMinutes(reward, function (balance) { that.setData({ gameMinutes: balance }) })
    }

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
