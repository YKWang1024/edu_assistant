var util = require('../../utils/util.js')

Page({
  data: {
    recipes: [],
    topRecipes: [],
    recommendations: [],
    nutritionAnalysis: null,
    activeFilter: 'all',
    filterOptions: ['all', '蛋白质', '蔬菜', '碳水', '水果']
  },

  onShow: function () {
    this.loadRecipes()
  },

  loadRecipes: function () {
    try {
      var recipes = wx.getStorageSync('recipes') || []
      this.processRecipes(recipes)
    } catch (e) {
      console.error('加载菜谱失败', e)
    }
  },

  processRecipes: function (recipes) {
    recipes.forEach(function (r) {
      if (!r.id) r.id = Date.now() + Math.random()
      if (!r.ratings) r.ratings = []
      if (!r.avgScore) r.avgScore = 0
    })

    var topRecipes = recipes.filter(function (r) { return r.avgScore > 0 })
    topRecipes.sort(function (a, b) { return b.avgScore - a.avgScore })
    topRecipes = topRecipes.slice(0, 10)

    var analysis = util.analyzeNutrition(recipes)
    var recommendations = util.getRecipeRecommendations(recipes)

    this.setData({
      recipes: recipes,
      topRecipes: topRecipes,
      recommendations: recommendations,
      nutritionAnalysis: analysis
    })
  },

  onFilterChange: function (e) {
    var filter = e.currentTarget.dataset.filter
    this.setData({ activeFilter: filter })
  },

  onAddRecipe: function () {
    wx.navigateTo({ url: '/pages/recipe/add' })
  },

  onViewDetail: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/recipe/detail?id=' + id })
  },

  onRateRecipe: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/recipe/rate?id=' + id })
  },

  getFilteredRecipes: function () {
    var filter = this.data.activeFilter
    if (filter === 'all') return this.data.recipes

    var categories = {
      '蛋白质': ['鸡', '鱼', '虾', '牛肉', '猪肉', '蛋', '豆腐', '鸭', '排骨', '羊肉'],
      '蔬菜': ['白菜', '菠菜', '西兰花', '胡萝卜', '土豆', '番茄', '黄瓜', '豆角', '茄子', '青椒', '生菜', '芹菜'],
      '碳水': ['米饭', '面条', '馒头', '包子', '饺子', '粥', '红薯', '玉米'],
      '水果': ['苹果', '香蕉', '橙子', '葡萄', '西瓜', '草莓', '梨', '桃']
    }

    var keywords = categories[filter] || []
    return this.data.recipes.filter(function (r) {
      return keywords.some(function (kw) {
        return r.name.indexOf(kw) >= 0 || (r.ingredients && r.ingredients.indexOf(kw) >= 0)
      })
    })
  }
})
