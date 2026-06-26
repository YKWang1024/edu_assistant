Page({
  data: {
    recipe: null,
    ratingList: [],   // 该菜谱全部有效评分(新→旧)，菜友圈全局可见(REQ-009)
    ratingCount: 0,
    showRatings: false
  },

  onLoad: function (options) {
    if (options.recipe) {
      var recipe = JSON.parse(decodeURIComponent(options.recipe))
      this.applyRecipe(recipe)
    }
  },

  // 菜友圈里展示该菜谱的全部评分(评分人/分数/评价/时间)，不按家庭隔离(REQ-009 评分全局可见)
  applyRecipe: function (recipe) {
    var list = (recipe.ratings || []).filter(function (r) { return !r.deleted }).map(function (r) {
      return {
        id: r.id,
        memberName: r.memberName || '匿名',
        score: r.score || 0,
        comment: r.comment || '',
        date: r.date || '',
        time: r.time || ''
      }
    })
    list.reverse() // 新→旧
    this.setData({ recipe: recipe, ratingList: list, ratingCount: list.length })
  },

  onToggleRatings: function () {
    if (this.data.ratingCount === 0) return
    this.setData({ showRatings: !this.data.showRatings })
  },

  onPreviewImage: function (e) {
    var recipe = this.data.recipe
    var imgs = (recipe.images && recipe.images.length) ? recipe.images : (recipe.imageUrl ? [recipe.imageUrl] : [])
    var current = e.currentTarget.dataset.src || imgs[0]
    if (imgs.length) wx.previewImage({ current: current, urls: imgs })
  },

  onShareAppMessage: function () {
    var recipe = this.data.recipe
    return {
      title: recipe.name + ' - 来自菜友圈',
      path: '/pages/circle/detail?recipe=' + encodeURIComponent(JSON.stringify(recipe))
    }
  }
})
