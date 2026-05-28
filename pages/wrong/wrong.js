var util = require('../../utils/util.js')

function getQuestionDisplay(item) {
  var op = item.operator || ''
  if (op.startsWith('english_')) {
    return {
      type: 'english',
      typeLabel: '英语',
      question: item.a,
      answer: item.answer,
      userAnswer: item.userAnswer
    }
  }
  if (op.startsWith('pinyin') || op === 'hanzi2pinyin' || op === 'pinyin2write') {
    return {
      type: 'pinyin',
      typeLabel: '拼音',
      question: item.a,
      answer: item.answer,
      userAnswer: item.userAnswer
    }
  }
  return {
    type: 'math',
    typeLabel: '数学',
    question: item.a + ' ' + op + ' ' + item.b + ' = ?',
    answer: item.answer,
    userAnswer: item.userAnswer,
    mathA: item.a,
    mathB: item.b,
    mathOp: op
  }
}

Page({
  data: {
    wrongList: [],
    practiceMode: false,
    practiceQuestions: [],
    practiceIndex: 0,
    practiceAnswer: '',
    practiceResults: []
  },

  onLoad: function () {
    this.loadWrongQuestions()
  },

  onShow: function () {
    this.loadWrongQuestions()
  },

  loadWrongQuestions: function () {
    var list = util.getWrongQuestions()
    list.sort(function (a, b) { return (b.count || 1) - (a.count || 1) })
    var displayList = list.map(function (item) {
      return Object.assign({}, item, getQuestionDisplay(item))
    })
    this.setData({ wrongList: displayList })
  },

  onStartPractice: function () {
    var list = this.data.wrongList
    if (list.length === 0) {
      wx.showToast({ title: '暂无错题', icon: 'none' })
      return
    }

    var practiceQuestions = list.slice(0, Math.min(10, list.length)).map(function (q) {
      return {
        a: q.a,
        b: q.b,
        operator: q.operator,
        answer: q.answer,
        userAnswer: '',
        isCorrect: false,
        type: q.type,
        typeLabel: q.typeLabel,
        question: q.question
      }
    })

    this.setData({
      practiceMode: true,
      practiceQuestions: practiceQuestions,
      practiceIndex: 0,
      practiceAnswer: '',
      practiceResults: []
    })
  },

  onPracticeInput: function (e) {
    this.setData({ practiceAnswer: e.detail.value })
  },

  onSubmitPractice: function () {
    var answer = this.data.practiceAnswer.trim()
    if (answer === '') {
      wx.showToast({ title: '请输入答案', icon: 'none' })
      return
    }

    var idx = this.data.practiceIndex
    var questions = this.data.practiceQuestions
    questions[idx].userAnswer = answer
    
    var current = questions[idx]
    if (current.type === 'math') {
      questions[idx].isCorrect = (parseInt(answer) === current.answer)
    } else {
      questions[idx].isCorrect = (answer === current.answer)
    }

    if (questions[idx].isCorrect) {
      this.removeFromWrongList(questions[idx])
    }

    var results = this.data.practiceResults
    results.push(questions[idx])

    if (idx < questions.length - 1) {
      this.setData({
        practiceIndex: idx + 1,
        practiceAnswer: '',
        practiceQuestions: questions,
        practiceResults: results
      })
    } else {
      var correct = results.filter(function (r) { return r.isCorrect }).length
      this.setData({
        practiceMode: false,
        practiceQuestions: questions,
        practiceResults: results
      })
      wx.showModal({
        title: '练习完成',
        content: '本次练习: ' + results.length + '题，答对 ' + correct + ' 题',
        showCancel: false
      })
      this.loadWrongQuestions()
    }
  },

  removeFromWrongList: function (question) {
    try {
      var wrongList = wx.getStorageSync('wrongQuestions') || []
      if (question.type === 'math') {
        wrongList = wrongList.filter(function (item) {
          return !(item.a === question.a && item.b === question.b && item.operator === question.operator)
        })
      } else {
        wrongList = wrongList.filter(function (item) {
          return !(item.a === question.a && item.operator === question.operator && item.answer === question.answer)
        })
      }
      wx.setStorageSync('wrongQuestions', wrongList)
    } catch (e) {}
  },

  onClearAll: function () {
    var that = this
    wx.showModal({
      title: '清空错题本',
      content: '确定要清空所有错题吗？',
      confirmColor: '#FF6B6B',
      success: function (res) {
        if (res.confirm) {
          try {
            wx.setStorageSync('wrongQuestions', [])
            that.setData({ wrongList: [] })
            wx.showToast({ title: '已清空', icon: 'success' })
          } catch (e) {}
        }
      }
    })
  },

  onDeleteOne: function (e) {
    var idx = e.currentTarget.dataset.index
    var wrongList = this.data.wrongList
    var item = wrongList[idx]
    this.removeFromWrongList(item)
    wrongList.splice(idx, 1)
    this.setData({ wrongList: wrongList })
  }
})