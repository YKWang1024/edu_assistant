function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var temp = arr[i]
    arr[i] = arr[j]
    arr[j] = temp
  }
  return arr
}

function generateOptions(answer) {
  var options = [answer]
  var offsets = [-2, -1, 1, 2]
  shuffleArray(offsets)
  for (var i = 0; i < offsets.length && options.length < 4; i++) {
    var opt = answer + offsets[i]
    if (opt >= 0 && options.indexOf(opt) < 0) {
      options.push(opt)
    }
  }
  var fill = 0
  while (options.length < 4) {
    if (options.indexOf(fill) < 0) options.push(fill)
    fill++
  }
  return shuffleArray(options)
}

function generateMathQuestions(count, maxNum) {
  var questions = []
  var minBig = maxNum > 10 ? 10 : 0
  for (var i = 0; i < count; i++) {
    var isAdd = Math.random() > 0.5
    var a, b, answer
    if (isAdd) {
      if (maxNum > 10) {
        a = Math.floor(Math.random() * (maxNum - minBig + 1)) + minBig
        b = Math.floor(Math.random() * (maxNum - a + 1))
      } else {
        a = Math.floor(Math.random() * (maxNum + 1))
        b = Math.floor(Math.random() * (maxNum - a + 1))
      }
      answer = a + b
    } else {
      if (maxNum > 10) {
        a = Math.floor(Math.random() * (maxNum - minBig + 1)) + minBig
        b = Math.floor(Math.random() * (a + 1))
      } else {
        a = Math.floor(Math.random() * (maxNum + 1))
        b = Math.floor(Math.random() * (a + 1))
      }
      answer = a - b
    }
    var options = generateOptions(answer)
    questions.push({
      id: i,
      a: a,
      b: b,
      operator: isAdd ? '+' : '-',
      answer: answer,
      options: options,
      userAnswer: '',
      isCorrect: false
    })
  }
  return questions
}

function calculateReward(type, actualTimeStr) {
  var parts = actualTimeStr.split(':')
  var hours = parseInt(parts[0])
  var minutes = parseInt(parts[1])
  var actualMinutes = hours * 60 + minutes

  var targetMinutes = 0
  var maxReward = 999
  var deductOnLate = false

  if (type === 'school') {
    targetMinutes = 8 * 60 + 10
    maxReward = 999
    deductOnLate = false
  } else if (type === 'homework') {
    targetMinutes = 19 * 60 + 30
    maxReward = 999
    deductOnLate = true
  } else if (type === 'sleep') {
    targetMinutes = 21 * 60 + 0
    maxReward = 10
    deductOnLate = false
  }

  var diff = targetMinutes - actualMinutes
  var reward = 0

  if (diff > 0) {
    reward = Math.min(diff, maxReward)
  } else if (diff < 0 && deductOnLate) {
    reward = diff
  }

  return {
    diff: diff,
    reward: reward,
    isEarly: diff > 0,
    isLate: diff < 0,
    isOnTime: diff === 0
  }
}

// 通用版打卡奖励计算(REQ-023/024 自定义习惯)：habit 来自 habitDefs，按 mode 分两种算法。
// mode='targetTime'：早/晚打卡，按与目标时间的差值算奖励(逻辑同旧版 calculateReward，只是参数从习惯定义读)。
// mode='fixed'：打卡即得固定数值，不需要 actualTimeStr。
function calculateHabitReward(habit, actualTimeStr) {
  if (!habit || habit.mode !== 'targetTime') {
    var fixed = (habit && Number(habit.fixedReward)) || 0
    return { diff: 0, reward: fixed, isEarly: fixed > 0, isLate: false, isOnTime: fixed === 0 }
  }
  var parts = (actualTimeStr || '00:00').split(':')
  var actualMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1])
  var tparts = (habit.targetTime || '00:00').split(':')
  var targetMinutes = parseInt(tparts[0]) * 60 + parseInt(tparts[1])
  var maxReward = (habit.maxReward != null) ? habit.maxReward : 999
  var deductOnLate = !!habit.deductOnLate

  var diff = targetMinutes - actualMinutes
  var reward = 0
  if (diff > 0) reward = Math.min(diff, maxReward)
  else if (diff < 0 && deductOnLate) reward = diff

  return { diff: diff, reward: reward, isEarly: diff > 0, isLate: diff < 0, isOnTime: diff === 0 }
}

function formatDate(date) {
  var y = date.getFullYear()
  var m = date.getMonth() + 1
  var d = date.getDate()
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d)
}

function formatTime(date) {
  var h = date.getHours()
  var m = date.getMinutes()
  return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m)
}

function getTodayStr() {
  return formatDate(new Date())
}

// 小测奖励的游戏时间(分钟)：答对率 >=80% 给 5 分钟，>=60% 给 2 分钟，否则 0。
function quizRewardMinutes(correct, total) {
  if (!total || total <= 0) return 0
  var rate = correct / total
  if (rate >= 0.8) return 5
  if (rate >= 0.6) return 2
  return 0
}

// 连续打卡天数：从今天(或昨天)往前数，连续有打卡记录的天数。
// records: [{date:'YYYY-MM-DD', ...}]（打卡/学习记录都行，有 date 即可）
function calculateStreak(records) {
  var days = {}
  ;(records || []).forEach(function (r) { if (r && r.date) days[r.date] = true })
  var d = new Date()
  if (!days[formatDate(d)]) {
    d.setDate(d.getDate() - 1)
    if (!days[formatDate(d)]) return 0 // 今天和昨天都没打卡，连续中断
  }
  var streak = 0
  while (days[formatDate(d)]) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function saveRecord(key, record) {
  try {
    var records = wx.getStorageSync(key) || []
    records.unshift(record)
    wx.setStorageSync(key, records)
    return true
  } catch (e) {
    console.error('保存记录失败', e)
    return false
  }
}

function getRecords(key) {
  try {
    return wx.getStorageSync(key) || []
  } catch (e) {
    return []
  }
}

function deriveSubject(operator) {
  operator = operator || ''
  if (operator.indexOf('english') === 0) return 'english'
  if (operator.indexOf('pinyin') >= 0 || operator === 'char2pinyin' || operator === 'pinyin2char' || operator === 'pinyin2write' || operator === 'hanzi2pinyin') return 'pinyin'
  return 'math'
}

function saveWrongQuestionLocal(question) {
  try {
    var wrongList = wx.getStorageSync('wrongQuestions') || []
    var exists = wrongList.some(function (item) {
      return item.a === question.a && item.b === question.b && item.operator === question.operator
    })
    if (!exists) {
      question.date = getTodayStr()
      question.count = 1
      wrongList.unshift(question)
    } else {
      wrongList.forEach(function (item) {
        if (item.a === question.a && item.b === question.b && item.operator === question.operator) {
          item.count = (item.count || 0) + 1
          item.lastDate = getTodayStr()
        }
      })
    }
    wx.setStorageSync('wrongQuestions', wrongList)
    return true
  } catch (e) {
    return false
  }
}

// 云就绪→写云端 quizWrong(fire-and-forget)；否则本地兜底
function saveWrongQuestion(question) {
  var app = getApp()
  if (app && app.globalData && app.globalData.cloudReady) {
    app.callCloudFunction('saveQuizWrong', {
      a: question.a,
      b: question.b,
      operator: question.operator,
      answer: question.answer,
      userAnswer: question.userAnswer,
      subject: deriveSubject(question.operator),
      childName: (app.getCurrentChild ? app.getCurrentChild() : (app.globalData.currentChild || '宝贝'))
    }, function () {})
    return true
  }
  return saveWrongQuestionLocal(question)
}

// 一局小测记录：云就绪→quizRecords；否则本地兜底
function saveQuizRecord(subject, record) {
  var app = getApp()
  if (app && app.globalData && app.globalData.cloudReady) {
    app.callCloudFunction('saveQuizRecord', {
      subject: subject,
      total: record.total,
      correct: record.correct,
      timeUsed: record.timeUsed,
      level: record.level,
      date: record.date,
      time: record.time
    }, function () {})
    return true
  }
  return saveRecord(subject + 'Records', record)
}

function getWrongQuestions() {
  try {
    return wx.getStorageSync('wrongQuestions') || []
  } catch (e) {
    return []
  }
}

function analyzeNutrition(recipes) {
  var categories = {
    '蛋白质': ['鸡', '鱼', '虾', '牛肉', '猪肉', '蛋', '豆腐', '鸭', '排骨', '羊肉'],
    '蔬菜': ['白菜', '菠菜', '西兰花', '胡萝卜', '土豆', '番茄', '黄瓜', '豆角', '茄子', '青椒', '生菜', '芹菜'],
    '碳水': ['米饭', '面条', '馒头', '包子', '饺子', '粥', '红薯', '玉米'],
    '水果': ['苹果', '香蕉', '橙子', '葡萄', '西瓜', '草莓', '梨', '桃']
  }

  var nutritionMap = {}
  recipes.forEach(function (recipe) {
    var tags = []
    Object.keys(categories).forEach(function (cat) {
      categories[cat].forEach(function (keyword) {
        if (recipe.name.indexOf(keyword) >= 0 || (recipe.ingredients && recipe.ingredients.indexOf(keyword) >= 0)) {
          if (tags.indexOf(cat) < 0) {
            tags.push(cat)
          }
        }
      })
    })
    nutritionMap[recipe.id] = tags
  })

  var covered = {}
  recipes.forEach(function (recipe) {
    var tags = nutritionMap[recipe.id] || []
    tags.forEach(function (tag) {
      covered[tag] = true
    })
  })

  var missing = Object.keys(categories).filter(function (cat) {
    return !covered[cat]
  })

  return {
    nutritionMap: nutritionMap,
    coveredCategories: Object.keys(covered),
    missingCategories: missing,
    balanceScore: Math.round((Object.keys(covered).length / Object.keys(categories).length) * 100)
  }
}

function getRecipeRecommendations(recipes, mealType) {
  var rated = recipes.filter(function (r) { return r.avgScore > 0 })
  rated.sort(function (a, b) { return b.avgScore - a.avgScore })

  var analysis = analyzeNutrition(recipes)

  var recommendations = rated.slice(0, 5)

  if (analysis.missingCategories.length > 0) {
    var supplementRecipes = recipes.filter(function (r) {
      var tags = analysis.nutritionMap[r.id] || []
      return analysis.missingCategories.some(function (cat) {
        return tags.indexOf(cat) >= 0
      })
    })
    supplementRecipes.forEach(function (r) {
      if (!recommendations.find(function (item) { return item.id === r.id })) {
        recommendations.push(r)
      }
    })
  }

  return recommendations
}

module.exports = {
  generateMathQuestions: generateMathQuestions,
  calculateReward: calculateReward,
  calculateHabitReward: calculateHabitReward,
  formatDate: formatDate,
  formatTime: formatTime,
  getTodayStr: getTodayStr,
  quizRewardMinutes: quizRewardMinutes,
  calculateStreak: calculateStreak,
  saveRecord: saveRecord,
  getRecords: getRecords,
  saveWrongQuestion: saveWrongQuestion,
  saveQuizRecord: saveQuizRecord,
  getWrongQuestions: getWrongQuestions,
  analyzeNutrition: analyzeNutrition,
  getRecipeRecommendations: getRecipeRecommendations
}
