var englishData = require('../../utils/englishData.js')
var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    mode: 'select',
    practiceModes: [
      { key: 'en2cn', name: '看英文选中文', desc: '看英文单词，选正确的中文', icon: '🔤' },
      { key: 'cn2en', name: '看中文选英文', desc: '看中文意思，选正确的英文', icon: '📖' },
      { key: 'sentence', name: '句型选择', desc: '完成英语句子，选正确答案', icon: '💬' },
      { key: 'confusion', name: '易混词辨析', desc: '区分容易搞混的单词', icon: '🤔' },
      { key: 'mix', name: '综合练习', desc: '混合所有题型', icon: '🎯' }
    ],
    selectedMode: 'en2cn',
    totalQuestions: 5,
    questions: [],
    currentIndex: 0,
    startTime: 0,
    selectedOption: -1,
    showResult: false,
    currentCorrect: false
  },

  // 练习页停留时长采集(REQ-003)
  onShow: function () { app.usageEnterPractice('english') },
  onHide: function () { app.usageLeavePractice() },
  onUnload: function () { app.usageLeavePractice() },

  onSelectMode: function (e) {
    this.setData({ selectedMode: e.currentTarget.dataset.mode })
  },

  onStartPractice: function () {
    var questions = englishData.generateEnglishQuestions(
      this.data.totalQuestions,
      this.data.selectedMode
    )
    if (questions.length === 0) {
      wx.showToast({ title: '题目数据不足', icon: 'none' })
      return
    }
    this.setData({
      mode: 'practice',
      questions: questions,
      currentIndex: 0,
      startTime: Date.now(),
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
        operator: 'english_' + questions[idx].type,
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
      type: 'english_' + this.data.selectedMode
    }
    util.saveQuizRecord('english', record)

    wx.redirectTo({
      url: '/pages/math/result?correct=' + correct + '&total=' + this.data.totalQuestions + '&time=' + timeUsed
    })
  }
})
