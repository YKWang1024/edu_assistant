var app = getApp()
var examUtil = require('../../utils/exam.js')
var config = require('../../config/ai.js')

var STATUS_LABEL = examUtil.STATUS_LABEL

var TYPE_LABELS = ['选择题', '填空/简答', '其他']
var TYPE_KEYS = ['choice', 'fill', 'other']

// 小测错题(quizWrong)归到哪个科目
function quizSubject(op) {
  op = op || ''
  if (op.indexOf('english_') === 0) return '英语'
  if (op.indexOf('pinyin') >= 0 || op === 'char2pinyin' || op === 'pinyin2char' || op === 'pinyin2write' || op === 'hanzi2pinyin') return '语文'
  return '数学'
}

// 把一条小测错题转成与拍照错题统一的展示结构
function quizToItem(q) {
  var subject = quizSubject(q.operator)
  var stem = subject === '数学'
    ? (q.a + ' ' + (q.operator || '') + ' ' + q.b + ' = ?')
    : String(q.a == null ? '' : q.a)
  return {
    _id: q._id,
    source: 'quiz',
    subject: subject,
    type: 'fill',
    stem: stem,
    options: [],
    correctAnswer: String(q.answer == null ? '' : q.answer),
    analysis: '',
    status: 'new',
    due: true,
    consecutiveWrong: 0,
    attempts: [],
    count: q.count || 1,
    operator: q.operator,
    date: q.date || q.lastDate || '',
    childName: q.childName || '宝贝'
  }
}

// 由 today(YYYY-MM-DD) 回退 n 天，得到日期串，用于「本周新增」统计
function daysAgoStr(today, n) {
  var p = (today || '').split('-')
  if (p.length !== 3) return ''
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
  d.setDate(d.getDate() - n)
  var m = d.getMonth() + 1
  var day = d.getDate()
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
}

Page({
  data: {
    loading: true,
    today: '',
    subjects: ['全部'].concat(config.SUBJECTS),
    activeSubject: '全部',
    childChips: [],        // ['全部', 名字...]；>1 个小孩时显示
    activeChild: '全部',
    groups: [],
    stats: { total: 0, due: 0, hard: 0, mastered: 0 },
    masteredPct: 0,
    weekAdded: 0,
    chartBars: [],

    mode: 'list', // list | practice | edit
    practiceList: [],
    practiceIndex: 0,
    current: null,
    selectedKey: '',
    answerInput: '',
    showResult: false,
    lastCorrect: false,
    submitting: false,
    needSelfReport: false,
    pendingAnswer: '',

    // 编辑
    typeLabels: TYPE_LABELS,
    editSubjects: config.SUBJECTS,
    editChildNames: [],
    editForm: null,
    savingEdit: false
  },

  onShow: function () {
    if (this.data.mode === 'list') this.loadList()
  },

  loadList: function () {
    var that = this
    that.setData({ loading: true })
    // 小孩筛选条：多于一个小孩时显示，可看各自的错题集
    var childNames = (app.globalData.children || []).map(function (c) { return c.name })
    if (childNames.length > 1) {
      that.setData({ childChips: ['全部'].concat(childNames) })
    } else {
      that.setData({ childChips: [] })
    }
    // 同一个错题本：拍照错题(examQuestions) + 语数英小测错题(quizWrong) 合并展示
    app.callCloudFunction('listExamQuestions', {}, function (res) {
      var examList = (res && res.success) ? (res.data || []) : []
      var today = (res && res.today) || examUtil.todayStrUTC8(0)
      app.callCloudFunction('listQuizWrong', {}, function (res2) {
        var quizList = (res2 && res2.success) ? (res2.data || []).map(quizToItem) : []
        that.buildGroups(examList.concat(quizList), today)
      })
    })
  },

  buildGroups: function (list, today) {
    var activeSubject = this.data.activeSubject
    var activeChild = this.data.activeChild
    // 按小孩筛选（无 childName 视为「宝贝」）
    if (activeChild && activeChild !== '全部') {
      list = list.filter(function (q) { return (q.childName || '宝贝') === activeChild })
    }
    var stats = { total: list.length, due: 0, hard: 0, mastered: 0 }
    var weekThreshold = daysAgoStr(today, 6) // 近 7 天(含今日)
    var weekAdded = 0
    var map = {}
    list.forEach(function (q) {
      q.source = q.source || 'exam'
      q.sourceLabel = q.source === 'quiz' ? '小测' : '试卷'
      q.statusText = STATUS_LABEL[q.status] || ''
      var stem = q.stem || ''
      q.stemBrief = stem.length > 42 ? (stem.slice(0, 42) + '…') : stem
      q.attemptCount = (q.attempts && q.attempts.length) || 0
      if (q.due) stats.due++
      if (q.status === 'hard') stats.hard++
      if (q.status === 'mastered') stats.mastered++
      // 本周新增：尽力从可用日期字段判断
      var d = q.date || (q.createdAt ? String(q.createdAt).slice(0, 10) : (q.lastDate || ''))
      if (weekThreshold && d && d >= weekThreshold) weekAdded++
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
    // 各科错题分布柱状图（按 config.SUBJECTS 稳定排序，仅含有错题的科目）
    var maxCount = 0
    Object.keys(map).forEach(function (s) { if (map[s].length > maxCount) maxCount = map[s].length })
    var chartBars = []
    config.SUBJECTS.forEach(function (s) {
      var c = map[s] ? map[s].length : 0
      if (c > 0) chartBars.push({ subject: s, count: c, pct: maxCount ? Math.max(8, Math.round(c / maxCount * 100)) : 0 })
    })
    var masteredPct = stats.total ? Math.round(stats.mastered / stats.total * 100) : 0
    this.setData({
      groups: groups, stats: stats, today: today, loading: false,
      weekAdded: weekAdded, masteredPct: masteredPct, chartBars: chartBars
    })
  },

  onSelectSubject: function (e) {
    this.setData({ activeSubject: e.currentTarget.dataset.subject }, this.loadList)
  },

  onSelectChild: function (e) {
    this.setData({ activeChild: e.currentTarget.dataset.child }, this.loadList)
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

    // 小测错题：本地判分，做对则从小测错题本移除(不走间隔复习)
    if (q.source === 'quiz') {
      this.submitQuiz(q, answer)
      return
    }

    // 无标准答案的题：让用户自评
    if (!q.correctAnswer) {
      this.setData({ needSelfReport: true, pendingAnswer: answer })
      return
    }
    this.submit({ questionId: q._id, answer: answer })
  },

  submitQuiz: function (q, answer) {
    var correct = q.subject === '数学'
      ? (parseInt(answer, 10) === parseInt(q.correctAnswer, 10))
      : (answer === q.correctAnswer)
    this.setData({ showResult: true, lastCorrect: correct })
    if (correct && q._id) {
      app.callCloudFunction('deleteQuizWrong', { id: q._id }, function () {})
    }
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
          content: '这道题连续做错 3 次了，要不要让智能老师讲解一下？',
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
    var source = e.currentTarget.dataset.source
    var that = this
    wx.showModal({
      title: '删除错题',
      content: '确定删除这道题吗？',
      confirmColor: '#ba1a1a',
      success: function (m) {
        if (!m.confirm) return
        var fn = source === 'quiz' ? 'deleteQuizWrong' : 'deleteExamQuestion'
        var payload = source === 'quiz' ? { id: id } : { questionId: id }
        app.callCloudFunction(fn, payload, function (res) {
          if (res && res.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            that.loadList()
          } else {
            wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' })
          }
        })
      }
    })
  },

  // ---------------- 家长编辑（密码保护） ----------------
  findItem: function (id) {
    var found = null
    this.data.groups.forEach(function (g) {
      g.items.forEach(function (i) { if (i._id === id) found = i })
    })
    return found
  },

  // 校验家长密码后执行 cb。密码每个用户自己设置(存云端)；未设置则首次引导设置。
  // 本次进入错题本验证过一次后即解锁(this._pwdOk)，避免反复输入。
  requirePassword: function (cb) {
    var that = this
    if (!app.globalData.cloudReady) { cb(); return } // 离线无法编辑云端数据，不拦截
    if (this._pwdOk) { cb(); return }
    app.callCloudFunction('editPassword', { action: 'status' }, function (res) {
      if (!res || !res.success) { wx.showToast({ title: '网络异常，请重试', icon: 'none' }); return }
      if (res.data && res.data.hasPassword) that.promptVerifyPassword(cb)
      else that.promptSetPassword(cb)
    })
  },

  promptSetPassword: function (cb) {
    var that = this
    wx.showModal({
      title: '设置家长密码',
      editable: true,
      placeholderText: '首次使用请设置(至少4位)',
      content: '',
      success: function (m) {
        if (!m.confirm) return
        var pwd = (m.content || '').trim()
        if (pwd.length < 4) { wx.showToast({ title: '密码至少 4 位', icon: 'none' }); return }
        app.callCloudFunction('editPassword', { action: 'set', password: pwd }, function (r) {
          if (r && r.success) { that._pwdOk = true; wx.showToast({ title: '已设置', icon: 'success' }); cb() }
          else wx.showToast({ title: (r && r.message) || '设置失败', icon: 'none' })
        })
      }
    })
  },

  promptVerifyPassword: function (cb) {
    var that = this
    wx.showModal({
      title: '家长验证',
      editable: true,
      placeholderText: '请输入家长密码',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('editPassword', { action: 'verify', password: (m.content || '').trim() }, function (r) {
          if (r && r.success && r.data && r.data.match) { that._pwdOk = true; cb() }
          else wx.showToast({ title: '密码不正确', icon: 'none' })
        })
      }
    })
  },

  onEditOne: function (e) {
    var id = e.currentTarget.dataset.id
    var source = e.currentTarget.dataset.source
    var that = this
    this.requirePassword(function () {
      if (source === 'quiz') that.editQuizAnswer(id)
      else that.openEditor(id)
    })
  },

  // 小测错题只改正确答案（题面是自动生成的）
  editQuizAnswer: function (id) {
    var that = this
    var item = this.findItem(id)
    wx.showModal({
      title: '修改正确答案',
      editable: true,
      placeholderText: '正确答案',
      content: item ? item.correctAnswer : '',
      success: function (m) {
        if (!m.confirm) return
        var ans = (m.content || '').trim()
        if (!ans) { wx.showToast({ title: '答案不能为空', icon: 'none' }); return }
        app.callCloudFunction('updateQuizWrong', { id: id, answer: ans }, function (res) {
          if (res && res.success) { wx.showToast({ title: '已保存', icon: 'success' }); that.loadList() }
          else wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
        })
      }
    })
  },

  // 拍照错题：进入完整编辑表单
  openEditor: function (id) {
    var item = this.findItem(id)
    if (!item) return
    var subjects = config.SUBJECTS
    var subjectIndex = subjects.indexOf(item.subject)
    if (subjectIndex < 0) subjectIndex = subjects.length - 1
    var typeIndex = TYPE_KEYS.indexOf(item.type)
    if (typeIndex < 0) typeIndex = 2
    var type = TYPE_KEYS[typeIndex]
    var options = (item.options && item.options.length)
      ? item.options.map(function (o) { return { key: o.key, text: o.text } })
      : []
    if (type === 'choice' && options.length === 0) {
      options = [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
    }
    // 归属小孩：可把错题分配给妹妹/姐姐等
    var childNames = (app.globalData.children || []).map(function (c) { return c.name })
    if (!childNames.length) childNames = ['宝贝']
    var childIndex = childNames.indexOf(item.childName || '宝贝')
    if (childIndex < 0) childIndex = 0
    this.setData({
      mode: 'edit',
      editChildNames: childNames,
      editForm: {
        _id: id,
        subject: subjects[subjectIndex],
        subjectIndex: subjectIndex,
        childName: childNames[childIndex],
        childIndex: childIndex,
        type: type,
        typeIndex: typeIndex,
        stem: item.stem || '',
        options: options,
        correctAnswer: item.correctAnswer || '',
        analysis: item.analysis || '',
        figure: item.figure || null
      }
    })
  },

  onEditChildChange: function (e) {
    var idx = Number(e.detail.value)
    this.setData({ 'editForm.childIndex': idx, 'editForm.childName': this.data.editChildNames[idx] })
  },

  onEditSubjectChange: function (e) {
    var idx = Number(e.detail.value)
    this.setData({ 'editForm.subjectIndex': idx, 'editForm.subject': this.data.editSubjects[idx] })
  },

  onEditTypeChange: function (e) {
    var idx = Number(e.detail.value)
    var type = TYPE_KEYS[idx]
    var patch = { 'editForm.typeIndex': idx, 'editForm.type': type }
    if (type === 'choice' && (!this.data.editForm.options || this.data.editForm.options.length === 0)) {
      patch['editForm.options'] = [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
    }
    this.setData(patch)
  },

  onEditStemInput: function (e) { this.setData({ 'editForm.stem': e.detail.value }) },
  onEditAnalysisInput: function (e) { this.setData({ 'editForm.analysis': e.detail.value }) },
  onEditCorrectInput: function (e) { this.setData({ 'editForm.correctAnswer': e.detail.value }) },

  onEditOptionInput: function (e) {
    var i = e.currentTarget.dataset.index
    this.setData({ ['editForm.options[' + i + '].text']: e.detail.value })
  },

  onEditSetCorrect: function (e) {
    this.setData({ 'editForm.correctAnswer': e.currentTarget.dataset.key })
  },

  onAddEditOption: function () {
    var options = this.data.editForm.options.slice()
    if (options.length >= 8) { wx.showToast({ title: '最多 8 个选项', icon: 'none' }); return }
    options.push({ key: String.fromCharCode(65 + options.length), text: '' })
    this.setData({ 'editForm.options': options })
  },

  onRemoveEditOption: function (e) {
    var i = e.currentTarget.dataset.index
    var options = this.data.editForm.options.slice()
    var removedKey = options[i] ? options[i].key : ''
    options.splice(i, 1)
    options = options.map(function (o, idx) { return { key: String.fromCharCode(65 + idx), text: o.text } })
    var patch = { 'editForm.options': options }
    if (this.data.editForm.correctAnswer === removedKey) patch['editForm.correctAnswer'] = ''
    this.setData(patch)
  },

  onCancelEdit: function () {
    this.setData({ mode: 'list', editForm: null, savingEdit: false })
  },

  onSaveEdit: function () {
    var f = this.data.editForm
    if (!f || this.data.savingEdit) return // 表单已关闭或正在保存，防重复提交导致空指针
    if (!f.stem || !f.stem.trim()) { wx.showToast({ title: '请填写题干', icon: 'none' }); return }
    var options = []
    if (f.type === 'choice') {
      options = (f.options || []).filter(function (o) { return o.text && o.text.trim() })
        .map(function (o) { return { key: o.key, text: o.text.trim() } })
      if (options.length < 2) { wx.showToast({ title: '选择题至少 2 个选项', icon: 'none' }); return }
      if (!f.correctAnswer) { wx.showToast({ title: '请标记正确答案', icon: 'none' }); return }
    }
    var that = this
    this.setData({ savingEdit: true })
    app.callCloudFunction('updateExamQuestion', {
      questionId: f._id,
      subject: f.subject,
      childName: f.childName,
      type: f.type,
      stem: f.stem.trim(),
      options: options,
      correctAnswer: (f.correctAnswer || '').trim(),
      analysis: (f.analysis || '').trim(),
      figure: f.figure || null
    }, function (res) {
      if (res && res.success) {
        wx.showToast({ title: '已保存', icon: 'success' })
        that.setData({ mode: 'list', editForm: null, savingEdit: false })
        that.loadList()
      } else {
        that.setData({ savingEdit: false })
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
      }
    })
  }
})
