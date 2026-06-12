Page({
  data: {
    recipe: null
  },

  onLoad: function (options) {
    if (options.recipe) {
      var recipe = JSON.parse(decodeURIComponent(options.recipe))
      this.setData({ recipe: recipe })
    }
  },

  onShareAppMessage: function () {
    var recipe = this.data.recipe
    return {
      title: recipe.name + ' - 来自菜友圈',
      path: '/pages/circle/detail?recipe=' + encodeURIComponent(JSON.stringify(recipe))
    }
  }
})