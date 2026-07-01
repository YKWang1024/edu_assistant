var app = getApp()
var recipeUtil = require('../../utils/recipe.js')
var imageUtil = require('../../utils/image.js')
var SUPER_OPENID = 'oSnsZ7e4ja7cq2Eq5_u3hQKx3HMo' // 超级用户(系统菜谱) REQ-022

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
    desc: '',
    ingredients: '',
    steps: '',
    category: '',
    categories: recipeUtil.CATEGORIES,
    categoryIndex: 0,
    // 建议餐次(REQ-020)。chip 的选中态在 JS 预算(WXML 不支持方法调用)
    mealChips: [{ label: '早餐', on: false }, { label: '中餐', on: false }, { label: '晚餐', on: false }],
    tags: '',
    nutrition: '',
    images: [], // 压缩后的本地临时路径
    editMode: false,    // 编辑已有菜谱(REQ-021)
    editId: '',
    sysMode: false,     // 系统菜谱(超级用户) REQ-022
    existingImages: [], // 编辑时原有图片(临时链接，只读预览，保存时保留原图不变)
    referenceInput: '', // 输入框原始文本(避免受控输入把输入清空)
    referenceLink: '',
    referenceType: '',
    referenceLabel: '',
    calories: null,
    recognizing: false,
    saving: false
  },

  onLoad: function (options) {
    options = options || {}
    var sysMode = options.sys === '1'
    if (sysMode) {
      // 系统菜谱管理仅超级用户(服务端也硬校验；此处拦住非超级用户的伪编辑界面)
      var ui = app.globalData.userInfo || {}
      if (ui.openid !== SUPER_OPENID) {
        wx.showToast({ title: '无系统菜谱管理权限', icon: 'none' })
        setTimeout(function () { wx.navigateBack() }, 1000)
        return
      }
      this.setData({ sysMode: true })
    }
    if (options.id) {
      this.setData({ editMode: true, editId: options.id })
      wx.setNavigationBarTitle({ title: sysMode ? '编辑系统菜谱' : '编辑菜谱' })
      this.loadForEdit(options.id, sysMode)
    } else if (sysMode) {
      wx.setNavigationBarTitle({ title: '新建系统菜谱' })
    }
  },

  // 载入待编辑菜谱(REQ-021；sys=系统菜谱 REQ-022)
  loadForEdit: function (id, sysMode) {
    var that = this
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再编辑', icon: 'none' }); return }
    var fn = sysMode ? 'listSystemRecipes' : 'listRecipes'
    app.callCloudFunction(fn, {}, function (res) {
      if (!res || !res.success) { wx.showToast({ title: '加载失败', icon: 'none' }); return }
      var r = (res.data || []).filter(function (x) { return x._id === id })[0]
      if (!r) { wx.showToast({ title: '菜谱不存在', icon: 'none' }); return }
      var ci = that.data.categories.indexOf(r.category)
      if (ci < 0) ci = that.data.categories.length - 1
      var imgs = (r.images && r.images.length) ? r.images : (r.imageUrl ? [r.imageUrl] : [])
      var selected = Array.isArray(r.mealTimes) ? r.mealTimes : []
      var chips = that.data.mealChips.map(function (c) { return { label: c.label, on: selected.indexOf(c.label) >= 0 } })
      that.setData({
        name: r.name || '',
        ingredients: r.ingredients || '',
        steps: r.steps || '',
        categoryIndex: ci,
        mealChips: chips,
        tags: r.tags || '',
        nutrition: r.nutrition || '',
        existingImages: imgs,
        referenceInput: r.referenceLink || '',
        referenceLink: r.referenceLink || '',
        referenceType: r.referenceType || '',
        referenceLabel: r.referenceLabel || '',
        calories: r.calories || null
      })
    })
  },

  // 勾选/取消「建议餐次」(可多选可空) REQ-020
  onToggleMeal: function (e) {
    var meal = e.currentTarget.dataset.meal
    var chips = this.data.mealChips.map(function (c) {
      return { label: c.label, on: c.label === meal ? !c.on : c.on }
    })
    this.setData({ mealChips: chips })
  },

  // 取当前选中的餐次数组(保存用)
  selectedMeals: function () {
    return this.data.mealChips.filter(function (c) { return c.on }).map(function (c) { return c.label })
  },

  onPreviewExisting: function (e) {
    var current = e.currentTarget.dataset.src
    wx.previewImage({ current: current, urls: this.data.existingImages })
  },

  onNameInput: function (e) { this.setData({ name: e.detail.value }) },
  onDescInput: function (e) { this.setData({ desc: e.detail.value }) },
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

  // 上传一张本地图片到云存储，按本地路径缓存 fileID（识别与保存复用，避免重复上传）。
  uploadImageCached: function (localPath) {
    var that = this
    if (!this._fileIDCache) this._fileIDCache = {}
    if (this._fileIDCache[localPath]) return Promise.resolve(this._fileIDCache[localPath])
    return recipeUtil.uploadImage(localPath).then(function (fid) {
      that._fileIDCache[localPath] = fid
      return fid
    })
  },

  onAIRecognize: function () {
    var that = this
    if (this.data.images.length === 0) { wx.showToast({ title: '请先添加成品照片', icon: 'none' }); return }
    this.setData({ recognizing: true })
    var path = this.data.images[0]
    // 菜名 + 一句话描述 一起作为识别提示，提升准确率
    var hint = [this.data.name, this.data.desc].map(function (s) { return (s || '').trim() }).filter(Boolean).join('，')

    // 优先「先上云存储拿 fileID → aiVision 云端下载识别」，规避 callFunction 包体上限；
    // 上传失败再回退压缩 base64 直传。识别所用 fileID 缓存复用，保存时不再重传。
    var p
    if (app.globalData.cloudReady && wx.cloud) {
      p = this.uploadImageCached(path).then(function (fid) {
        return recipeUtil.recognizeRecipe({ fileID: fid, mediaType: 'image/jpeg' }, hint)
      }, function () {
        return imageUtil.compressForCloud(path).then(function (c) { return recipeUtil.recognizeRecipe(c.dataUri, hint) })
      })
    } else {
      p = imageUtil.compressForCloud(path).then(function (c) { return recipeUtil.recognizeRecipe(c.dataUri, hint) })
    }

    p.then(function (rp) {
      that.applyRecognized(rp)
      that.setData({ recognizing: false })
      wx.showToast({ title: '已识别，可修改', icon: 'success' })
    }).catch(function (err) {
      that.setData({ recognizing: false })
      var m = (err && err.message) || ''
      if (/key|密钥|未配置|api/i.test(m)) m = '智能识别暂不可用（后端未配置密钥），请手动填写菜谱'
      wx.showModal({ title: '识别失败', content: m || '请手动填写', showCancel: false })
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
    if (this.data.saving) return

    // 编辑模式：只改文本字段 + 建议餐次，图片保留原样(不重传)。
    // 系统菜谱(sysMode)走 saveSystemRecipe(带 recipeId)，普通菜谱走 updateRecipe(REQ-021)。
    if (this.data.editMode) {
      this.setData({ saving: true })
      var editFn = this.data.sysMode ? 'saveSystemRecipe' : 'updateRecipe'
      app.callCloudFunction(editFn, {
        recipeId: that.data.editId,
        name: name,
        ingredients: that.data.ingredients.trim(),
        steps: that.data.steps.trim(),
        category: that.data.categories[that.data.categoryIndex],
        mealTimes: that.selectedMeals(),
        tags: that.data.tags.trim(),
        nutrition: that.data.nutrition.trim(),
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
      return
    }

    this.setData({ saving: true })
    var imgs = this.data.images.slice()
    var fileIDs = []

    function doSave() {
      // 新建：系统菜谱走 saveSystemRecipe(REQ-022)，普通菜谱走 saveRecipe
      var saveFn = that.data.sysMode ? 'saveSystemRecipe' : 'saveRecipe'
      app.callCloudFunction(saveFn, {
        name: name,
        ingredients: that.data.ingredients.trim(),
        steps: that.data.steps.trim(),
        category: that.data.categories[that.data.categoryIndex],
        mealTimes: that.selectedMeals(),
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
      // 复用识别阶段已上传的 fileID（命中缓存则不重传）
      that.uploadImageCached(imgs[i])
        .then(function (fid) { fileIDs.push(fid); uploadNext(i + 1) })
        .catch(function () { uploadNext(i + 1) }) // 单张失败跳过
    }

    uploadNext(0)
  }
})
