Page({
  data: {
    recipe: null,
    recipeId: null,
    displayImages: [],
    currentImageIndex: 0
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ recipeId: parseFloat(options.id) })
      this.loadRecipe()
    }
  },

  onShow: function () {
    this.loadRecipe()
  },

  loadRecipe: function () {
    try {
      var recipes = wx.getStorageSync('recipes') || []
      var id = this.data.recipeId
      var recipe = recipes.find(function (r) { return r.id === id })
      if (recipe) {
        if (recipe.referenceLink && !recipe.referenceType) {
          var lower = recipe.referenceLink.toLowerCase()
          if (lower.indexOf('xiaohongshu.com') >= 0 || lower.indexOf('xhslink.com') >= 0) {
            recipe.referenceType = 'xiaohongshu'
            recipe.referenceLabel = '小红书'
          } else if (lower.indexOf('bilibili.com') >= 0 || lower.indexOf('b23.tv') >= 0) {
            recipe.referenceType = 'bilibili'
            recipe.referenceLabel = '哔哩哔哩'
          } else {
            recipe.referenceType = 'other'
            recipe.referenceLabel = '其他'
          }
        }

        var images = []
        if (recipe.images && recipe.images.length > 0) {
          images = recipe.images
        } else if (recipe.imageUrl) {
          images = [recipe.imageUrl]
        }

        this.setData({
          recipe: recipe,
          displayImages: images,
          currentImageIndex: 0
        })
      }
    } catch (e) {
      console.error('加载菜谱失败', e)
    }
  },

  onSwiperChange: function (e) {
    this.setData({ currentImageIndex: e.detail.current })
  },

  onPreviewImage: function (e) {
    var current = e.currentTarget.dataset.src || this.data.displayImages[this.data.currentImageIndex]
    wx.previewImage({
      current: current,
      urls: this.data.displayImages
    })
  },

  onOpenReference: function () {
    var link = this.data.recipe.referenceLink
    if (!link) return

    wx.navigateTo({
      url: '/pages/webview/webview?url=' + encodeURIComponent(link)
    })
  },

  onRateRecipe: function () {
    wx.navigateTo({ url: '/pages/recipe/rate?id=' + this.data.recipeId })
  },

  onDeleteRecipe: function () {
    var that = this
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这道菜谱吗？',
      success: function (res) {
        if (res.confirm) {
          try {
            var recipes = wx.getStorageSync('recipes') || []
            var id = that.data.recipeId
            recipes = recipes.filter(function (r) { return r.id !== id })
            wx.setStorageSync('recipes', recipes)
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(function () {
              wx.navigateBack()
            }, 1500)
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  }
})
