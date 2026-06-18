var app = getApp()
var examUtil = require('../../utils/exam.js')
var config = require('../../config/ai.js')

var STATUS_LABEL = examUtil.STATUS_LABEL

Page({
  data: {
    loading: true,
    today: '',
    subjects: ['全部'].concat(config.SUBJECTS),
    activeSubject: '全部',
    groups: [],
    stats: { total: 0, due: 0, hard: 0, mastered: 0 },

    mode: 'list', // list | practice
    practiceList: [],
    practiceIndex: 0,
    current: null,
    selectedKey: '',
    answerInput: '',
    showResult: false,
    lastCorrect: false,
    submitting: false,
    needSelfReport: false,
    pendingAnswer: ''
  },

  onShow: function () {
    if (this.data.mode === 'list') this.loadList()
  },

  loadList: function () {
    var that = this
    that.setData({ loading: true })
    app.callCloudFunction('listExamQuestions', {}, function (res) {
      if (!res || !res.success) {
        that.setData({ loading: false })
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' })
        return
      }
      that.buildGroups(res.data || [], res.today || examUtil.todayStrUTC8(0))
    })
  },

  buildGroups: function (list, today) {
    var activeSubject = this.data.activeSubject
    var stats = { total: list.length, due: 0, hard: 0, mastered: 0 }
    var map = {}
    list.forEach(function (q) {
      q.statusText = STATUS_LABEL[q.status] || ''
      var stem = q.stem || ''
      q.stemBrief = stem.length > 42 ? (stem.slice(0, 42) + '…') : stem
      q.attemptCount = (q.attempts && q.attempts.length) || 0
      if (q.due) stats.due++
      if (q.status === 'hard') stats.hard++
      if (q.status === 'mastered') stats.mastered++
      if (!map[q.subject]) map[q.subject] = []
      map[q.subject].push(q)
    })
    var groups = []
    Object.keys(map).forEach(function (subject) {
      if (activeSubject !== '全部' && subject !== activeSubject) return
      var items = map[subject]
      var dueCount = items.filter(function (i) { return i.due }).length
      groups.push({ subject: subject, items: items, dueCount: dueCount })
    })
    this.setData({ groups: groups, stats: stats, today: today, loading: false })
  },

  onSelectSubject: function (e) {
    this.setData({ activeSubject: e.currentTarget.dataset.subject }, this.loadList)
  },

  onTapCapture: function () {
    wx.navigateTo({ url: '/pages/exam/capture' })
  },

  // ---------------- 复习/重做 ----------------
  onStartPractice: function () {
    var practiceList = []
    this.data.groups.forEach(function (g) {
      g.items.forEach(function (i) { if (i.due) practiceList.push(i) })
    })
    if (practiceList.length === 0) {
      wx.showToast({ title: '暂无到期错题', icon: 'none' })
      return
    }
    this.setData({
      mode: 'practice',
      practiceList: practiceList,
      practiceIndex: 0
    })
    this.showCurrent()
  },

  showCurrent: function () {
    var q = this.data.practiceList[this.data.practiceIndex]
    this.setData({
      current: q,
      selectedKey: '',
      answerInput: '',
      showResult: false,
      lastCorrect: false,
      needSelfReport: false,
      pendingAnswer: ''
    })
  },

  onSelectOption: function (e) {
    if (this.data.showResult) return
    this.setData({ selectedKey: e.currentTarget.dataset.key })
  },

  onAnswerInput: function (e) {
    this.setData({ answerInput: e.detail.value })
  },

  onSubmitAnswer: function () {
    var q = this.data.current
    if (!q) return
    var answer
    if (q.type === 'choice') {
      if (!this.data.selectedKey) { wx.showToast({ title: '请选择一个选项', icon: 'none' }); return }
      answer = this.data.selectedKey
    } else {
      answer = (this.data.answerInput || '').trim()
      if (!answer) { wx.showToast({ title: '请输入答案', icon: 'none' }); return }
    }

    // 无标准答案的题：让用户自评
    if (!q.correctAnswer) {
      this.setData({ needSelfReport: true, pendingAnswer: answer })
      return
    }
    this.submit({ questionId: q._id, answer: answer })
  },

  onSelfReport: function (e) {
    var correct = e.currentTarget.dataset.correct === 'true'
    this.setData({ needSelfReport: false })
    this.submit({ questionId: this.data.current._id, answer: this.data.pendingAnswer || '', correct: correct })
  },

  submit: function (payload) {
    var that = this
    that.setData({ submitting: true })
    app.callCloudFunction('submitExamAnswer', payload, function (res) {
      that.setData({ submitting: false })
      if (!res || !res.success) {
        wx.showToast({ title: (res && res.message) || '提交失败', icon: 'none' })
        return
      }
      that.setData({ showResult: true, lastCorrect: res.correct })
      if (res.becameHard) {
        wx.showModal({
          title: '重点疑难题',
          content: '这道题连续做错 3 次了，要不要让 AI 老师讲解一下？',
          confirmText: '去学习',
          cancelText: '稍后',
          success: function (m) {
            if (m.confirm) wx.navigateTo({ url: '/pages/exam/course?id=' + payload.questionId })
          }
        })
      }
    })
  },

  onNext: function () {
    var idx = this.data.practiceIndex
    if (idx < this.data.practiceList.length - 1) {
      this.setData({ practiceIndex: idx + 1 })
      this.showCurrent()
    } else {
      wx.showToast({ title: '复习完成！🎉', icon: 'success' })
      this.exitPractice()
    }
  },

  onExitPractice: function () {
    this.exitPractice()
  },

  exitPractice: function () {
    this.setData({ mode: 'list', current: null })
    this.loadList()
  },

  // ---------------- 列表操作 ----------------
  onViewCourse: function (e) {
    wx.navigateTo({ url: '/pages/exam/course?id=' + e.currentTarget.dataset.id })
  },

  onDeleteOne: function (e) {
    var id = e.currentTarget.dataset.id
    var that = this
    wx.showModal({
      title: '删除错题',
      content: '确定删除这道题吗？',
      confirmColor: '#ba1a1a',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('deleteExamQuestion', { questionId: id }, function (res) {
          if (res && res.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            that.loadList()
          } else {
            wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' })
          }
        })
      }
    })
  }
})
