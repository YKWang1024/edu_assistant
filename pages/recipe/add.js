var app = getApp()
var recipeUtil = require('../../utils/recipe.js')

function extractUrl(text) {
  if (!text) return ''
  var urlPattern = /https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+/gi
  var matches = text.match(urlPattern)
  if (matches && matches.length > 0) return matches[0]
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
    categories: recipeUtil.CATEGORIES,
    categoryIndex: 0,
    tags: '',
    nutrition: '',
    images: [], // 压缩后的本地临时路径
    referenceInput: '', // 输入框原始文本(避免受控输入把输入清空)
    referenceLink: '',
    referenceType: '',
    referenceLabel: '',
    calories: null,
    recognizing: false,
    saving: false
  },

  onNameInput: function (e) { this.setData({ name: e.detail.value }) },
  onIngredientsInput: function (e) { this.setData({ ingredients: e.detail.value }) },
  onStepsInput: function (e) { this.setData({ steps: e.detail.value }) },
  onCategoryChange: function (e) { this.setData({ categoryIndex: e.detail.value }) },
  onTagsInput: function (e) { this.setData({ tags: e.detail.value }) },

  getCanvasNode: function (cb) {
    if (this._canvasNode) { cb(this._canvasNode); return }
    var that = this
    wx.createSelectorQuery().select('#recipeCanvas').fields({ node: true }).exec(function (r) {
      if (r && r[0] && r[0].node) { that._canvasNode = r[0].node; cb(r[0].node) }
      else cb(null)
    })
  },

  onChooseImage: function () {
    var that = this
    var remaining = 2 - that.data.images.length
    if (remaining <= 0) { wx.showToast({ title: '最多上传2张照片', icon: 'none' }); return }
    wx.chooseMedia({
      count: remaining,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: function (res) {
        that.getCanvasNode(function (node) {
          var files = res.tempFiles
          var i = 0
          function next() {
            if (i >= files.length || that.data.images.length >= 2) return
            recipeUtil.compressImage(node, files[i].tempFilePath, 1280, 0.8).then(function (p) {
              var imgs = that.data.images.slice()
              imgs.push(p)
              that.setData({ images: imgs })
              i++
              next()
            })
          }
          next()
        })
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
    wx.previewImage({ current: current, urls: this.data.images })
  },

  onReferenceLinkInput: function (e) {
    var raw = e.detail.value
    var link = extractUrl(raw.trim())
    var type = detectLinkType(link)
    var label = ''
    if (type === 'xiaohongshu') label = '小红书'
    else if (type === 'bilibili') label = '哔哩哔哩'
    else if (link) label = '其他'
    // referenceInput 保留用户原始输入(不回写)，referenceLink 仅用于展示标签与保存
    this.setData({ referenceInput: raw, referenceLink: link, referenceType: type, referenceLabel: label })
  },

  onAIRecognize: function () {
    var that = this
    if (this.data.images.length === 0) { wx.showToast({ title: '请先添加成品照片', icon: 'none' }); return }
    this.setData({ recognizing: true })
    wx.getFileSystemManager().readFile({
      filePath: this.data.images[0],
      encoding: 'base64',
      success: function (r) {
        var dataUri = 'data:image/jpeg;base64,' + r.data
        recipeUtil.recognizeRecipe(dataUri, that.data.name).then(function (rp) {
          that.applyRecognized(rp)
          that.setData({ recognizing: false })
          wx.showToast({ title: '已识别，可修改', icon: 'success' })
        }).catch(function (err) {
          that.setData({ recognizing: false })
          wx.showModal({ title: '识别失败', content: (err && err.message) || '请手动填写', showCancel: false })
        })
      },
      fail: function () {
        that.setData({ recognizing: false })
        wx.showToast({ title: '读取图片失败', icon: 'none' })
      }
    })
  },

  applyRecognized: function (rp) {
    var categoryIndex = this.data.categories.indexOf(rp.category)
    if (categoryIndex < 0) categoryIndex = this.data.categories.length - 1
    this.setData({
      name: rp.name || this.data.name,
      ingredients: rp.ingredients || this.data.ingredients,
      steps: rp.steps || this.data.steps,
      tags: rp.tags || this.data.tags,
      nutrition: rp.nutrition || this.data.nutrition,
      categoryIndex: categoryIndex,
      calories: rp.calories || this.data.calories
    })
  },

  onSave: function () {
    var that = this
    var name = this.data.name.trim()
    if (!name) { wx.showToast({ title: '请输入菜名', icon: 'none' }); return }
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再保存', icon: 'none' }); return }

    this.setData({ saving: true })
    var imgs = this.data.images.slice()
    var fileIDs = []

    function doSave() {
      app.callCloudFunction('saveRecipe', {
        name: name,
        ingredients: that.data.ingredients.trim(),
        steps: that.data.steps.trim(),
        category: that.data.categories[that.data.categoryIndex],
        tags: that.data.tags.trim(),
        nutrition: that.data.nutrition.trim(),
        images: fileIDs,
        referenceLink: that.data.referenceLink.trim(),
        referenceType: that.data.referenceType,
        referenceLabel: that.data.referenceLabel,
        calories: that.data.calories
      }, function (res) {
        that.setData({ saving: false })
        if (res && res.success) {
          wx.showToast({ title: '已保存', icon: 'success' })
          setTimeout(function () { wx.navigateBack() }, 1200)
        } else {
          wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
        }
      })
    }

    function uploadNext(i) {
      if (i >= imgs.length) { doSave(); return }
      recipeUtil.uploadImage(imgs[i])
        .then(function (fid) { fileIDs.push(fid); uploadNext(i + 1) })
        .catch(function () { uploadNext(i + 1) }) // 单张失败跳过
    }

    uploadNext(0)
  }
})
