var app = getApp()
var examUtil = require('../../utils/exam.js')
var config = require('../../config/ai.js')

Page({
  data: {
    loading: true,
    generating: false,
    error: '',
    content: '',
    question: null,
    cached: false
  },

  onLoad: function (options) {
    this.questionId = options.id
    if (!this.questionId) {
      this.setData({ loading: false, error: '缺少题目 ID' })
      return
    }
    this.loadQuestion()
  },

  loadQuestion: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      this.setData({ loading: false, error: '云开发未就绪，请稍后重试' })
      return
    }
    // 走云函数读取(支持家长跨成员查看孩子的题目)
    app.callCloudFunction('getExamQuestion', { questionId: this.questionId }, function (res) {
      if (res && res.success && res.data) {
        var q = res.data
        that.setData({ question: q, loading: false })
        if (q.aiCourse && q.aiCourse.content) {
          that.setData({ content: q.aiCourse.content, cached: true })
        } else {
          that.generate(q)
        }
      } else {
        that.setData({ loading: false, error: (res && res.message) || '加载题目失败' })
      }
    })
  },

  generate: function (q) {
    var that = this
    that.setData({ generating: true, content: '', error: '', cached: false })
    examUtil.generateCourse(q, function (chunk, full) {
      that.setData({ content: full })
    }).then(function (full) {
      that.setData({ generating: false, content: full })
      if (full) {
        app.callCloudFunction('saveExamCourse', { questionId: that.questionId, content: full }, function () {})
      }
    }).catch(function (err) {
      console.error('generate course fail', err)
      var msg = 'AI 生成失败，请重试'
      if (config.DEBUG && err && err.message) msg = err.message
      that.setData({ generating: false, error: msg })
    })
  },

  onRegenerate: function () {
    if (this.data.question) this.generate(this.data.question)
  }
})
