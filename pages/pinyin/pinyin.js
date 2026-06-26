var pinyinData = require('../../utils/pinyinData.js')
var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    mode: 'select',
    practiceModes: [
      { key: 'char2pinyin', name: '看字选拼音', desc: '给出汉字，选择正确拼音', icon: '🔤' },
      { key: 'pinyin2char', name: '看拼音选字', desc: '给出拼音，选择正确汉字', icon: '📖' },
      { key: 'pinyin2write', name: '看拼音写字', desc: '给出拼音，手写输入汉字', icon: '✍️' }
    ],
    listTypes: [
      { key: 'shizi', name: '识字表', desc: '认识常用汉字', icon: '👀' },
      { key: 'xiezi', name: '写字表', desc: '练习书写汉字', icon: '✏️' }
    ],
    selectedMode: 'char2pinyin',
    selectedList: 'shizi',
    totalQuestions: 5,
    questions: [],
    currentIndex: 0,
    startTime: 0,
    selectedOption: -1,
    showResult: false,
    currentCorrect: false,
    writeAnswer: ''
  },

  // 练习页停留时长采集(REQ-003)
  onShow: function () { app.usageEnterPractice('pinyin') },
  onHide: function () { app.usageLeavePractice() },
  onUnload: function () { app.usageLeavePractice() },

  onSelectMode: function (e) {
    this.setData({ selectedMode: e.currentTarget.dataset.mode })
  },

  onSelectList: function (e) {
    this.setData({ selectedList: e.currentTarget.dataset.list })
  },

  onStartPractice: function () {
    var questions = pinyinData.generatePinyinQuestions(
      this.data.totalQuestions,
      this.data.selectedMode,
      this.data.selectedList
    )
    if (questions.length === 0) {
      wx.showToast({ title: '字表数据不足', icon: 'none' })
      return
    }
    this.setData({
      mode: 'practice',
      questions: questions,
      currentIndex: 0,
      startTime: Date.now(),
      selectedOption: -1,
      showResult: false,
      currentCorrect: false,
      writeAnswer: ''
    })
  },

  onSelectOption: function (e) {
    if (this.data.showResult) return

    var optionIdx = e.currentTarget.dataset.index
    var idx = this.data.currentIndex
    var questions = this.data.questions
    var selected = questions[idx].options[optionIdx]
    var isCorrect = (selected === questions[idx].answer)
    app.usageTapInc()
    wx.vibrateShort({ type: isCorrect ? 'light' : 'heavy' })

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
        a: questions[idx].prompt,
        b: '',
        operator: questions[idx].type,
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
          currentCorrect: false,
          writeAnswer: ''
        })
      } else {
        that.finishRound()
      }
    }, 1000)
  },

  onWriteInput: function (e) {
    this.setData({ writeAnswer: e.detail.value })
  },

  onSubmitWrite: function () {
    var answer = this.data.writeAnswer.trim()
    if (!answer) {
      wx.showToast({ title: '请输入汉字', icon: 'none' })
      return
    }

    var idx = this.data.currentIndex
    var questions = this.data.questions
    var isCorrect = (answer === questions[idx].answer)
    app.usageTapInc()
    wx.vibrateShort({ type: isCorrect ? 'light' : 'heavy' })

    questions[idx].userAnswer = answer
    questions[idx].isCorrect = isCorrect

    this.setData({
      showResult: true,
      currentCorrect: isCorrect,
      questions: questions
    })

    if (!isCorrect) {
      util.saveWrongQuestion({
        a: questions[idx].prompt,
        b: '',
        operator: 'pinyin2write',
        answer: questions[idx].answer,
        userAnswer: answer
      })
    }

    var that = this
    setTimeout(function () {
      if (idx < that.data.totalQuestions - 1) {
        that.setData({
          currentIndex: idx + 1,
          selectedOption: -1,
          showResult: false,
          currentCorrect: false,
          writeAnswer: ''
        })
      } else {
        that.finishRound()
      }
    }, 1200)
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
      type: 'pinyin_' + this.data.selectedMode,
      listType: this.data.selectedList
    }
    util.saveQuizRecord('pinyin', record)

    wx.redirectTo({
      url: '/pages/math/result?correct=' + correct + '&total=' + this.data.totalQuestions + '&time=' + timeUsed
    })
  }
})
