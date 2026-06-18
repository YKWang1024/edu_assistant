var app = getApp()
var util = require('../../utils/util.js')

Page({
  data: {
    recipe: null,
    recipeId: '',
    displayImages: [],
    currentImageIndex: 0,
    visibleRatings: [],
    isAdmin: false,
    myOpenid: ''
  },

  onLoad: function (options) {
    if (options.id) this.setData({ recipeId: options.id })
    var ui = app.globalData.userInfo || {}
    this.setData({ myOpenid: ui.openid || '', isAdmin: ui.familyRole === 'admin' })
  },

  onShow: function () {
    this.loadRecipe()
  },

  loadRecipe: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      var cache = []
      try { cache = wx.getStorageSync('recipesCache') || [] } catch (e) {}
      var cr = cache.filter(function (x) { return x._id === that.data.recipeId })[0]
      if (cr) that.applyRecipe(cr)
      return
    }
    app.callCloudFunction('listRecipes', {}, function (res) {
      if (res && res.success) {
        var r = (res.data || []).filter(function (x) { return x._id === that.data.recipeId })[0]
        if (r) that.applyRecipe(r)
        else wx.showToast({ title: '菜谱不存在或已删除', icon: 'none' })
      } else {
        wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' })
      }
    })
  },

  applyRecipe: function (recipe) {
    var images = (recipe.images && recipe.images.length) ? recipe.images : (recipe.imageUrl ? [recipe.imageUrl] : [])
    var myOpenid = this.data.myOpenid
    var isAdmin = this.data.isAdmin
    var visible = (recipe.ratings || []).filter(function (r) { return !r.deleted }).map(function (r) {
      return Object.assign({}, r, { canManage: (r.memberOpenid === myOpenid) || isAdmin })
    })
    visible.reverse() // 新→旧
    this.setData({ recipe: recipe, displayImages: images, currentImageIndex: 0, visibleRatings: visible })
  },

  onSwiperChange: function (e) {
    this.setData({ currentImageIndex: e.detail.current })
  },

  onPreviewImage: function (e) {
    var current = e.currentTarget.dataset.src || this.data.displayImages[this.data.currentImageIndex]
    wx.previewImage({ current: current, urls: this.data.displayImages })
  },

  onOpenReference: function () {
    var recipe = this.data.recipe
    if (!recipe || !recipe.referenceLink) return
    var link = recipe.referenceLink
    if (recipe.referenceType === 'xiaohongshu') {
      wx.setClipboardData({
        data: link,
        success: function () { wx.showToast({ title: '已复制，请打开小红书查看', icon: 'none', duration: 2000 }) }
      })
    } else {
      wx.navigateTo({ url: '/pages/webview/webview?url=' + encodeURIComponent(link) })
    }
  },

  onRateRecipe: function () {
    wx.navigateTo({ url: '/pages/recipe/rate?id=' + this.data.recipeId })
  },

  onEditRating: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/recipe/rate?id=' + this.data.recipeId + '&ratingId=' + id })
  },

  onDeleteRating: function (e) {
    var that = this
    var id = e.currentTarget.dataset.id
    var date = e.currentTarget.dataset.date
    var today = util.getTodayStr()
    if (date >= today) {
      wx.showModal({
        title: '删除评分',
        content: '确定删除这条评分吗？',
        confirmColor: '#ba1a1a',
        success: function (m) { if (m.confirm) that.doDeleteRating(id, false) }
      })
    } else {
      wx.showModal({
        title: '删除历史评分',
        editable: true,
        placeholderText: '输入“删除”确认',
        content: '该评分是 ' + date + ' 的历史记录，删除请输入“删除”二字确认。',
        success: function (m) {
          if (m.confirm && (m.content || '').trim() === '删除') that.doDeleteRating(id, true)
          else if (m.confirm) wx.showToast({ title: '未输入“删除”，已取消', icon: 'none' })
        }
      })
    }
  },

  doDeleteRating: function (ratingId, confirmBeforeToday) {
    var that = this
    app.callCloudFunction('deleteRating', { recipeId: that.data.recipeId, ratingId: ratingId, confirmBeforeToday: confirmBeforeToday }, function (res) {
      if (res && res.success) { wx.showToast({ title: '已删除', icon: 'success' }); that.loadRecipe() }
      else wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' })
    })
  },

  onShareToCircle: function () {
    var that = this
    wx.showModal({
      title: '分享到菜友圈',
      content: '确定把这道菜分享到菜友圈吗？',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('shareRecipe', { recipeId: that.data.recipeId, shareMessage: '' }, function (res) {
          if (res && res.success) wx.showToast({ title: '已分享', icon: 'success' })
          else wx.showToast({ title: (res && res.message) || '分享失败', icon: 'none' })
        })
      }
    })
  },

  onDeleteRecipe: function () {
    var that = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这道菜谱吗？',
      confirmColor: '#ba1a1a',
      success: function (res) {
        if (!res.confirm) return
        app.callCloudFunction('deleteRecipe', { recipeId: that.data.recipeId }, function (r) {
          if (r && r.success) {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(function () { wx.navigateBack() }, 1200)
          } else {
            wx.showToast({ title: (r && r.message) || '删除失败', icon: 'none' })
          }
        })
      }
    })
  }
})
