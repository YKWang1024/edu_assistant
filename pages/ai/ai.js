var app = getApp()
var util = require('../../utils/util.js')

// 小测错题 operator → 科目（与 exam.js 一致）
function quizSubject(op) {
  op = op || ''
  if (op.indexOf('english_') === 0) return '英语'
  if (op.indexOf('pinyin') >= 0 || op === 'char2pinyin' || op === 'pinyin2char' || op === 'pinyin2write' || op === 'hanzi2pinyin') return '语文'
  return '数学'
}

var BAR_COLORS = ['#4ca85f', '#8b6fd6', '#4b86ef', '#f5a623', '#e5484d', '#3fb6c0']

Page({
  data: {
    loading: true,
    offline: false,
    childName: '宝贝',
    summary: '',
    bars: [],        // [{subject, pct, count, color}]
    wrongTips: [],
    cookTips: [],
    hasWrong: false
  },

  onShow: function () {
    this.setData({ childName: app.getCurrentChild() })
    this.loadAll()
  },

  loadAll: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      this.setData({ loading: false, offline: true })
      return
    }
    this.setData({ loading: true, offline: false })
    app.callCloudFunction('listExamQuestions', {}, function (r1) {
      var examList = (r1 && r1.success) ? (r1.data || []) : []
      app.callCloudFunction('listQuizWrong', {}, function (r2) {
        var quizList = (r2 && r2.success) ? (r2.data || []) : []
        that.buildStudy(examList, quizList)
        app.callCloudFunction('listRecipes', {}, function (r3) {
          var recipes = (r3 && r3.success) ? (r3.data || []) : []
          that.buildCooking(recipes)
          that.buildSummary()
          that.setData({ loading: false })
        })
      })
    })
  },

  buildStudy: function (examList, quizList) {
    var map = {}
    function init(s) { if (!map[s]) map[s] = { total: 0, mastered: 0, due: 0, hard: 0 } }
    examList.forEach(function (q) {
      var s = q.subject || '其他'; init(s); map[s].total++
      if (q.status === 'mastered') map[s].mastered++
      if (q.due) map[s].due++
      if (q.status === 'hard') map[s].hard++
    })
    quizList.forEach(function (q) {
      var s = quizSubject(q.operator); init(s); map[s].total++; map[s].due++
    })
    var subjects = Object.keys(map)
    var bars = subjects.map(function (s, i) {
      var m = map[s]
      return { subject: s, pct: m.total ? Math.round(m.mastered / m.total * 100) : 0, count: m.total, color: BAR_COLORS[i % BAR_COLORS.length] }
    }).sort(function (a, b) { return b.count - a.count })

    var totalWrong = examList.length + quizList.length
    var totalMastered = 0, totalDue = 0, hardCount = 0
    subjects.forEach(function (s) { totalMastered += map[s].mastered; totalDue += map[s].due; hardCount += map[s].hard })

    var tips = []
    if (totalWrong === 0) {
      tips.push('最近没有新增错题，继续保持这个好节奏！')
    } else {
      var weak = subjects.slice().sort(function (a, b) {
        return (map[b].total - map[b].mastered) - (map[a].total - map[a].mastered)
      })[0]
      if (weak && (map[weak].total - map[weak].mastered) > 0) {
        tips.push('「' + weak + '」未掌握最多（' + (map[weak].total - map[weak].mastered) + ' 道），建议优先复习。')
      }
      if (totalDue > 0) tips.push('当前 ' + totalDue + ' 道错题待复习，每天做 2~3 道，掌握率会稳步上升。')
      if (hardCount > 0) tips.push('有 ' + hardCount + ' 道反复做错的疑难题，建议看看 AI 老师讲解。')
      if (tips.length === 0) tips.push('错题都在稳步掌握中，继续加油！')
    }
    this._totalWrong = totalWrong
    this._totalMastered = totalMastered
    this.setData({ bars: bars, wrongTips: tips, hasWrong: totalWrong > 0 })
  },

  buildCooking: function (recipes) {
    var tips = []
    if (!recipes.length) {
      tips.push('还没有菜谱，去「菜谱」记录家里的拿手菜，我就能给出营养建议啦。')
      this._hasRecipe = false
      this._balance = 0
      this.setData({ cookTips: tips })
      return
    }
    var analysis = util.analyzeNutrition(recipes)
    var recs = util.getRecipeRecommendations(recipes)
    tips.push('近期家庭营养均衡度 ' + analysis.balanceScore + '%。')
    if (analysis.missingCategories.length) {
      tips.push('饮食里较缺少「' + analysis.missingCategories.join('、') + '」类，建议本周补充。')
    } else {
      tips.push('荤素搭配比较均衡，继续保持～')
    }
    if (recs.length) {
      tips.push('今日推荐：' + recs[0].name + (recs[0].avgScore ? ('（⭐' + recs[0].avgScore + '）') : '') + '。')
    }
    this._hasRecipe = true
    this._balance = analysis.balanceScore
    this.setData({ cookTips: tips })
  },

  buildSummary: function () {
    var tw = this._totalWrong || 0
    var tm = this._totalMastered || 0
    var s = '已记录 ' + tw + ' 道错题、掌握 ' + tm + ' 道'
    if (this._hasRecipe) s += '；家庭营养均衡度 ' + (this._balance || 0) + '%'
    s += '。' + (tw === 0 ? '学习状态不错，继续加油！' : '坚持复习，进步会越来越明显。')
    this.setData({ summary: s })
  },

  onGoWrong: function () { wx.navigateTo({ url: '/pages/exam/exam' }) },
  onGoRecipe: function () { wx.switchTab({ url: '/pages/recipe/recipe' }) }
})
