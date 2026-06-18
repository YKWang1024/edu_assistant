var app = getApp()
var examUtil = require('../../utils/exam.js')

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
    if (!app.globalData.cloudReady || !wx.cloud || !wx.cloud.database) {
      this.setData({ loading: false, error: '云开发未就绪，请稍后重试' })
      return
    }
    wx.cloud.database().collection('examQuestions').doc(this.questionId).get({
      success: function (res) {
        var q = res.data
        that.setData({ question: q, loading: false })
        if (q && q.aiCourse && q.aiCourse.content) {
          that.setData({ content: q.aiCourse.content, cached: true })
        } else if (q) {
          that.generate(q)
        } else {
          that.setData({ error: '题目不存在' })
        }
      },
      fail: function (err) {
        console.error('load question fail', err)
        that.setData({ loading: false, error: '加载题目失败' })
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
      that.setData({ generating: false, error: (err && err.message) || 'AI 生成失败，请重试' })
    })
  },

  onRegenerate: function () {
    if (this.data.question) this.generate(this.data.question)
  }
})
