var util = require('../../utils/util.js')

function extractUrl(text) {
  if (!text) return ''
  var urlPattern = /https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+/gi
  var matches = text.match(urlPattern)
  if (matches && matches.length > 0) {
    return matches[0]
  }
  return ''
}

function detectLinkType(url) {
  if (!url) return ''
  var lower = url.toLowerCase()
  if (lower.indexOf('xiaohongshu.com') >= 0 || lower.indexOf('xhslink.com') >= 0) return 'xiaohongshu'
  if (lower.indexOf('bilibili.com') >= 0 || lower.indexOf('b23.tv') >= 0) return 'bilibili'
  return 'other'
}

Page({
  data: {
    name: '',
    ingredients: '',
    steps: '',
    category: '',
    categories: ['荤菜', '素菜', '汤类', '主食', '水果', '其他'],
    categoryIndex: 0,
    tags: '',
    nutrition: '',
    images: [],
    referenceLink: '',
    referenceType: '',
    referenceLabel: '',
    calories: null,
    analyzing: false
  },

  onNameInput: function (e) {
    this.setData({ name: e.detail.value })
  },

  onIngredientsInput: function (e) {
    this.setData({ ingredients: e.detail.value })
  },

  onStepsInput: function (e) {
    this.setData({ steps: e.detail.value })
  },

  onCategoryChange: function (e) {
    this.setData({ categoryIndex: e.detail.value })
  },

  onTagsInput: function (e) {
    this.setData({ tags: e.detail.value })
  },

  onChooseImage: function () {
    var that = this
    var remaining = 2 - that.data.images.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传2张照片', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: function (res) {
        var newImages = that.data.images.slice()
        res.tempFiles.forEach(function (file) {
          if (newImages.length < 2) {
            newImages.push(file.tempFilePath)
          }
        })
        that.setData({ images: newImages })
      }
    })
  },

  onRemoveImage: function (e) {
    var idx = e.currentTarget.dataset.index
    var images = this.data.images.slice()
    images.splice(idx, 1)
    this.setData({ images: images })
  },

  onPreviewImage: function (e) {
    var current = e.currentTarget.dataset.src
    wx.previewImage({
      current: current,
      urls: this.data.images
    })
  },

  onReferenceLinkInput: function (e) {
    var inputText = e.detail.value.trim()
    var link = extractUrl(inputText)
    var type = detectLinkType(link)
    var label = ''
    if (type === 'xiaohongshu') label = '小红书'
    else if (type === 'bilibili') label = '哔哩哔哩'
    else if (link) label = '其他'
    this.setData({
      referenceLink: link,
      referenceType: type,
      referenceLabel: label
    })
  },

  onAnalyzeCalories: function () {
    var foodName = this.data.name.trim()
    if (!foodName) {
      wx.showToast({ title: '请先输入菜名', icon: 'none' })
      return
    }

    this.setData({ analyzing: true })

    wx.cloud.callFunction({
      name: 'aiRecognize',
      data: {
        foodName: foodName
      },
      success: function (res) {
        if (res.result.success && res.result.data) {
          this.setData({ calories: res.result.data })
        } else {
          wx.showToast({ title: '识别失败', icon: 'none' })
        }
      }.bind(this),
      fail: function () {
        wx.showToast({ title: '识别失败', icon: 'none' })
      },
      complete: function () {
        this.setData({ analyzing: false })
      }.bind(this)
    })
  },

  onSave: function () {
    var name = this.data.name.trim()
    if (!name) {
      wx.showToast({ title: '请输入菜名', icon: 'none' })
      return
    }

    var recipe = {
      id: Date.now(),
      name: name,
      ingredients: this.data.ingredients.trim(),
      steps: this.data.steps.trim(),
      category: this.data.categories[this.data.categoryIndex],
      tags: this.data.tags.trim(),
      nutrition: this.data.nutrition.trim(),
      images: this.data.images,
      referenceLink: this.data.referenceLink.trim(),
      referenceType: this.data.referenceType,
      referenceLabel: this.data.referenceLabel,
      calories: this.data.calories,
      ratings: [],
      avgScore: 0,
      createDate: util.getTodayStr(),
      createTime: util.formatTime(new Date())
    }

    try {
      var recipes = wx.getStorageSync('recipes') || []
      recipes.push(recipe)
      wx.setStorageSync('recipes', recipes)
      wx.showToast({ title: '添加成功', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 1500)
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
})
