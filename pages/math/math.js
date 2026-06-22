var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    mode: 'select',
    levels: [
      { key: 10, name: '10以内加减法', desc: '入门级', icon: '🌱' },
      { key: 20, name: '20以内加减法', desc: '进阶级', icon: '🌳' }
    ],
    selectedLevel: 20,
    questions: [],
    currentIndex: 0,
    totalQuestions: 5,
    maxNum: 20,
    startTime: 0,
    answering: true,
    selectedOption: -1,
    showResult: false,
    currentCorrect: false
  },

  onLoad: function () {
    var savedLevel = 20
    try {
      var sl = wx.getStorageSync('mathLevel')
      if (sl === 10 || sl === 20) savedLevel = sl
    } catch (e) {}
    this.setData({ selectedLevel: savedLevel, maxNum: savedLevel })
  },

  onSelectLevel: function (e) {
    var level = e.currentTarget.dataset.level
    this.setData({
      selectedLevel: level,
      maxNum: level
    })
    try { wx.setStorageSync('mathLevel', level) } catch (e) {}
  },

  onStartPractice: function () {
    var questions = util.generateMathQuestions(this.data.totalQuestions, this.data.selectedLevel)
    this.setData({
      mode: 'practice',
      questions: questions,
      currentIndex: 0,
      startTime: Date.now(),
      answering: true,
      selectedOption: -1,
      showResult: false,
      currentCorrect: false
    })
  },

  onSelectOption: function (e) {
    if (this.data.showResult) return

    var optionIdx = e.currentTarget.dataset.index
    var idx = this.data.currentIndex
    var questions = this.data.questions
    var selected = questions[idx].options[optionIdx]
    var isCorrect = (selected === questions[idx].answer)

    questions[idx].userAnswer = selected
    questions[idx].isCorrect = isCorrect

    this.setData({
      selectedOption: optionIdx,
      showResult: true,
      currentCorrect: isCorrect,
      questions: questions
    })

    if (!isCorrect) {
      util.saveWrongQuestion({
        a: questions[idx].a,
        b: questions[idx].b,
        operator: questions[idx].operator,
        answer: questions[idx].answer,
        userAnswer: selected
      })
    }

    var that = this
    setTimeout(function () {
      if (idx < that.data.totalQuestions - 1) {
        that.setData({
          currentIndex: idx + 1,
          selectedOption: -1,
          showResult: false,
          currentCorrect: false
        })
      } else {
        that.finishRound()
      }
    }, 800)
  },

  finishRound: function () {
    var questions = this.data.questions
    var correct = 0
    questions.forEach(function (q) {
      if (q.isCorrect) correct++
    })
    var timeUsed = Math.round((Date.now() - this.data.startTime) / 1000)

    var record = {
      date: util.getTodayStr(),
      time: util.formatTime(new Date()),
      total: this.data.totalQuestions,
      correct: correct,
      timeUsed: timeUsed,
      level: this.data.selectedLevel,
      questions: questions
    }
    util.saveQuizRecord('math', record)

    wx.redirectTo({
      url: '/pages/math/result?correct=' + correct + '&total=' + this.data.totalQuestions + '&time=' + timeUsed
    })
  }
})
