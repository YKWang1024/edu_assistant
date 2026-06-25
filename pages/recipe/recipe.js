var util = require('../../utils/util.js')
var app = getApp()

Page({
  data: {
    recipes: [],
    displayRecipes: [],
    topRecipes: [],
    recommendations: [],
    nutritionAnalysis: null,
    activeFilter: 'all',
    filterOptions: ['all', '蛋白质', '蔬菜', '碳水', '水果'],
    loading: true,
    offline: false
  },

  onShow: function () {
    this.loadRecipes()
  },

  loadRecipes: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      this.loadCache(true)
      return
    }
    app.callCloudFunction('listRecipes', {}, function (res) {
      if (res && res.success) {
        var list = res.data || []
        try { wx.setStorageSync('recipesCache', list) } catch (e) {}
        that.maybeMigrate(function () {
          that.processRecipes(list)
          that.setData({ loading: false, offline: false })
        })
      } else {
        that.loadCache(false)
        if (res && res.code !== 'NO_FAMILY') wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' })
      }
    })
  },

  loadCache: function (offline) {
    var list = []
    try { list = wx.getStorageSync('recipesCache') || [] } catch (e) {}
    this.processRecipes(list)
    this.setData({ loading: false, offline: offline })
  },

  // 首次联网把本地旧菜谱(文字)导入云端，仅一次
  maybeMigrate: function (done) {
    var migrated = false
    try { migrated = wx.getStorageSync('migratedRecipes') } catch (e) {}
    if (migrated) { done(); return }

    var local = []
    try { local = wx.getStorageSync('recipes') || [] } catch (e) {}
    if (!local.length) {
      try { wx.setStorageSync('migratedRecipes', true) } catch (e) {}
      done()
      return
    }

    var i = 0
    function next() {
      if (i >= local.length) {
        try { wx.setStorageSync('migratedRecipes', true) } catch (e) {}
        wx.showToast({ title: '本地菜谱已导入云端', icon: 'none' })
        done()
        return
      }
      var r = local[i]
      app.callCloudFunction('saveRecipe', {
        name: r.name,
        ingredients: r.ingredients || '',
        steps: r.steps || '',
        category: r.category || '其他',
        tags: r.tags || '',
        nutrition: r.nutrition || '',
        images: [], // 本地临时图片路径已失效，跳过
        referenceLink: r.referenceLink || '',
        referenceType: r.referenceType || '',
        referenceLabel: r.referenceLabel || '',
        calories: r.calories || null
      }, function () { i++; next() })
    }
    next()
  },

  processRecipes: function (recipes) {
    var EMOJI = { '荤菜': '🍖', '素菜': '🥬', '汤类': '🍲', '主食': '🍚', '水果': '🍎', '其他': '🍽️' }
    recipes.forEach(function (r) {
      if (r._id) r.id = r._id // 兼容旧 wxml 与 util(按 id 聚合)
      if (!r.ratings) r.ratings = []
      if (!r.avgScore) r.avgScore = 0
      r.thumbEmoji = EMOJI[r.category] || '🍽️' // 无图时的分类占位
    })

    var topRecipes = recipes.filter(function (r) { return r.avgScore > 0 })
    topRecipes.sort(function (a, b) { return b.avgScore - a.avgScore })
    topRecipes = topRecipes.slice(0, 10)

    var analysis = util.analyzeNutrition(recipes)
    var recommendations = util.getRecipeRecommendations(recipes)

    this.setData({
      recipes: recipes,
      displayRecipes: this.getFilteredRecipes(recipes, this.data.activeFilter),
      topRecipes: topRecipes,
      recommendations: recommendations,
      nutritionAnalysis: analysis
    })
  },

  onFilterChange: function (e) {
    var filter = e.currentTarget.dataset.filter
    this.setData({ activeFilter: filter, displayRecipes: this.getFilteredRecipes(this.data.recipes, filter) })
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

  getFilteredRecipes: function (recipes, filter) {
    recipes = recipes || []
    if (filter === 'all') return recipes

    var categories = {
      '蛋白质': ['鸡', '鱼', '虾', '牛肉', '猪肉', '蛋', '豆腐', '鸭', '排骨', '羊肉'],
      '蔬菜': ['白菜', '菠菜', '西兰花', '胡萝卜', '土豆', '番茄', '黄瓜', '豆角', '茄子', '青椒', '生菜', '芹菜'],
      '碳水': ['米饭', '面条', '馒头', '包子', '饺子', '粥', '红薯', '玉米'],
      '水果': ['苹果', '香蕉', '橙子', '葡萄', '西瓜', '草莓', '梨', '桃']
    }

    var keywords = categories[filter] || []
    return recipes.filter(function (r) {
      return keywords.some(function (kw) {
        return r.name.indexOf(kw) >= 0 || (r.ingredients && r.ingredients.indexOf(kw) >= 0)
      })
    })
  }
})
