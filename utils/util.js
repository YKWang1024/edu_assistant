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

function saveWrongQuestion(question) {
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
  formatDate: formatDate,
  formatTime: formatTime,
  getTodayStr: getTodayStr,
  saveRecord: saveRecord,
  getRecords: getRecords,
  saveWrongQuestion: saveWrongQuestion,
  getWrongQuestions: getWrongQuestions,
  analyzeNutrition: analyzeNutrition,
  getRecipeRecommendations: getRecipeRecommendations
}
