var app = getApp()
var util = require('../../utils/util.js')

Page({
  data: {
    childName: '宝贝',
    childAvatar: '',
    level: 1,
    gameMinutes: 0,
    studyMinutes: 0,
    streak: 0,
    doneCount: 0,
    progressPct: 0,
    // 成长轨迹(REQ-017 迁到首页 + REQ-018 综合内容：爱吃的菜/评分/错题)
    likedCount: 0,      // 高分(爱吃的)菜品数
    ratingCount: 0,     // 累计给出的评分数
    topDishes: [],      // 高分菜 Top3
    wrongTotal: 0,      // 错题累积
    wrongMastered: 0,   // 已巩固错题
    hasGrowth: false,
    // 多角色视角(REQ-015)：child=孩子学习视角 / parent=家长管控视角
    viewRole: 'child',
    usageTodayTaps: 0,
    usageTodayDwellMin: 0,
    todayChecked: {
      school: false,
      homework: false,
      sleep: false
    }
  },

  onShow: function () {
    var that = this
    // 先用缓存值显示，避免首屏闪现 0
    var cached = app.globalData.gameMinutes || 0
    this.setData({
      childName: app.getCurrentChild(),
      gameMinutes: cached,
      level: this.calcLevel(cached),
      studyMinutes: app.getTodayStudyMinutes()
    })
    app.refreshGameTime(function (balance) {
      that.setData({ gameMinutes: balance, level: that.calcLevel(balance) })
    })
    // 拉取家庭小孩列表，保证可切换妹妹/姐姐等小孩账户；同步当前小孩头像(REQ-012)
    app.refreshFamily(function () {
      that.setData({ childName: app.getCurrentChild(), childAvatar: that.currentChildAvatar() })
    })
    this.checkTodayStatus()
    this.loadGrowth()
    if (this.data.viewRole === 'parent') this.loadParentStats()
  },

  // 成长轨迹(REQ-018)：综合 爱吃的菜+评分(菜谱) 与 错题累积/已巩固(错题本)
  loadGrowth: function () {
    var that = this
    if (!app.globalData.cloudReady) return
    // 1) 菜谱评分：高分菜(爱吃的) + 累计评分数
    app.callCloudFunction('listRecipes', {}, function (res) {
      var recipes = (res && res.success) ? (res.data || []) : []
      var ratingCount = 0
      var dishes = []
      recipes.forEach(function (r) {
        var active = (r.ratings || []).filter(function (x) { return !x.deleted })
        ratingCount += active.length
        var avg = Number(r.avgScore) || 0
        if (avg > 0) dishes.push({ id: r._id, name: r.name, avgScore: avg })
      })
      dishes.sort(function (a, b) { return b.avgScore - a.avgScore })
      var liked = dishes.filter(function (d) { return d.avgScore >= 4 })
      that.setData({
        ratingCount: ratingCount,
        likedCount: liked.length,
        topDishes: dishes.slice(0, 3)
      })
      that.refreshGrowthFlag()
    })
    // 2) 错题：累积 + 已巩固(status mastered)，按当前小孩
    app.callCloudFunction('listExamQuestions', { childName: app.getCurrentChild() }, function (res) {
      var list = (res && res.success) ? (res.data || []) : []
      var mastered = list.filter(function (q) { return q.status === 'mastered' }).length
      that.setData({ wrongTotal: list.length, wrongMastered: mastered })
      that.refreshGrowthFlag()
    })
  },

  refreshGrowthFlag: function () {
    var d = this.data
    this.setData({ hasGrowth: (d.ratingCount > 0 || d.topDishes.length > 0 || d.wrongTotal > 0) })
  },

  // 取当前小孩头像(来自家庭数据，已在 getFamilyInfo 转临时链接)
  currentChildAvatar: function () {
    var name = app.getCurrentChild()
    var c = (app.globalData.children || []).filter(function (x) { return x.name === name })[0]
    return (c && c.avatar) || ''
  },

  // 切换当前小孩(妹妹/姐姐等)，影响错题/打分归属
  // 多角色切换(REQ-015)：孩子(各小孩) + 家长。切到家长需密码验证。
  onSwitchRole: function () {
    var that = this
    var children = app.globalData.children || []
    var names = children.map(function (c) { return c.name })
    if (!names.length) names = [app.getCurrentChild()] // 至少有当前小孩
    var items = names.concat(['👨‍👩‍👧 家长'])
    wx.showActionSheet({
      itemList: items,
      success: function (res) {
        if (res.tapIndex === names.length) {
          that.enterParentView()
        } else {
          var name = names[res.tapIndex]
          app.setCurrentChild(name)
          app.clearParentVerified() // 切回孩子身份，家长验证失效(REQ-013/015)
          that.setData({ viewRole: 'child', childName: name, childAvatar: that.currentChildAvatar() })
          that.loadGrowth()
          wx.showToast({ title: '已切换到 ' + name, icon: 'none' })
        }
      }
    })
  },

  // 进入家长视角：已验证直接进；否则按密码(有则验证，无则引导设置)
  enterParentView: function () {
    var that = this
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再切换家长', icon: 'none' }); return }
    if (app.isParentVerified()) { that.showParentView(); return }
    app.callCloudFunction('editPassword', { action: 'status' }, function (res) {
      if (!res || !res.success) { wx.showToast({ title: '网络异常，请重试', icon: 'none' }); return }
      if (res.data && res.data.hasPassword) that.promptParentPwd()
      else that.promptSetParentPwd()
    })
  },

  promptParentPwd: function () {
    var that = this
    wx.showModal({
      title: '家长验证', editable: true, placeholderText: '请输入家长密码',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('editPassword', { action: 'verify', password: (m.content || '').trim() }, function (r) {
          if (r && r.success && r.data && r.data.match) { app.markParentVerified(); that.showParentView() }
          else wx.showToast({ title: '密码不正确', icon: 'none' })
        })
      }
    })
  },

  promptSetParentPwd: function () {
    var that = this
    wx.showModal({
      title: '设置家长密码', editable: true, placeholderText: '首次使用请设置(至少4位)',
      success: function (m) {
        if (!m.confirm) return
        var pwd = (m.content || '').trim()
        if (pwd.length < 4) { wx.showToast({ title: '密码至少 4 位', icon: 'none' }); return }
        app.callCloudFunction('editPassword', { action: 'set', password: pwd }, function (r) {
          if (r && r.success) { app.markParentVerified(); wx.showToast({ title: '已设置', icon: 'success' }); that.showParentView() }
          else wx.showToast({ title: (r && r.message) || '设置失败', icon: 'none' })
        })
      }
    })
  },

  showParentView: function () {
    this.setData({ viewRole: 'parent' })
    this.loadParentStats()
  },

  // 家长视角统计：今日练习互动/停留(REQ-003 usage)，其余沿用已加载的时长/游戏/错题
  loadParentStats: function () {
    var that = this
    this.setData({ studyMinutes: app.getTodayStudyMinutes() })
    if (!app.globalData.cloudReady) return
    app.getUsageStats(app.getCurrentChild(), 7, function (data) {
      if (!data) return
      that.setData({
        usageTodayTaps: (data.today && data.today.taps) || 0,
        usageTodayDwellMin: Math.floor(((data.today && data.today.dwellSec) || 0) / 60)
      })
    })
  },

  onGoAccount: function () { wx.navigateTo({ url: '/pages/account/account' }) },
  onGoSettings: function () { wx.switchTab({ url: '/pages/vip/vip' }) },

  // 由成长值(累计游戏时间)粗略折算等级，纯展示用
  calcLevel: function (val) {
    return Math.max(1, Math.floor((val || 0) / 50) + 1)
  },

  applyChecked: function (checked, records) {
    var done = (checked.school ? 1 : 0) + (checked.homework ? 1 : 0) + (checked.sleep ? 1 : 0)
    this.setData({
      todayChecked: checked,
      doneCount: done,
      progressPct: Math.round(done / 3 * 100),
      streak: util.calculateStreak(records || [])
    })
  },

  checkTodayStatus: function () {
    var that = this
    var today = util.getTodayStr()
    function applyLocal() {
      var records = util.getRecords('rewardRecords')
      var checked = { school: false, homework: false, sleep: false }
      records.forEach(function (r) { if (r.date === today) checked[r.type] = true })
      that.applyChecked(checked, records)
    }
    if (!app.globalData.cloudReady) { applyLocal(); return }
    app.callCloudFunction('listCheckins', {}, function (res) {
      if (res && res.success) {
        var records = res.data || []
        var checked = { school: false, homework: false, sleep: false }
        records.forEach(function (r) { if (r.date === today) checked[r.type] = true })
        that.applyChecked(checked, records)
      } else {
        applyLocal()
      }
    })
  },

  // 今日一键小测：随机一科，降低每日启动摩擦
  onTapDailyQuiz: function () {
    var subs = ['/pages/math/math', '/pages/pinyin/pinyin', '/pages/english/english']
    wx.navigateTo({ url: subs[Math.floor(Math.random() * subs.length)] })
  },

  onTapFamily: function () {
    wx.navigateTo({ url: '/pages/family/manage' })
  },

  onTapMath: function () {
    wx.navigateTo({ url: '/pages/math/math' })
  },

  onTapPinyin: function () {
    wx.navigateTo({ url: '/pages/pinyin/pinyin' })
  },

  onTapEnglish: function () {
    wx.navigateTo({ url: '/pages/english/english' })
  },

  onTapReward: function () {
    wx.navigateTo({ url: '/pages/reward/reward' })
  },

  onTapRecipe: function () {
    wx.switchTab({ url: '/pages/recipe/recipe' })
  },

  onTapAccount: function () {
    wx.switchTab({ url: '/pages/account/account' })
  },

  onTapWrong: function () {
    // 统一错题本(拍照错题 + 语数英小测错题)
    wx.navigateTo({ url: '/pages/exam/exam' })
  },

  onTapExam: function () {
    // 直接进入拍照录题(快速添加)
    wx.navigateTo({ url: '/pages/exam/capture' })
  }
})
