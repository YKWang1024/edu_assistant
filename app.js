App({
  globalData: {
    gameMinutes: 0
  },

  onLaunch: function () {
    this.loadLocalData()
  },

  loadLocalData: function () {
    try {
      var gameMinutes = wx.getStorageSync('gameMinutes')
      if (gameMinutes !== '') {
        this.globalData.gameMinutes = gameMinutes
      }
    } catch (e) {
      console.error('读取本地数据失败', e)
    }
  },

  saveGameMinutes: function (minutes) {
    this.globalData.gameMinutes = minutes
    try {
      wx.setStorageSync('gameMinutes', minutes)
    } catch (e) {
      console.error('保存游戏时间失败', e)
    }
  },

  addGameMinutes: function (minutes) {
    var total = this.globalData.gameMinutes + minutes
    if (total < 0) total = 0
    this.saveGameMinutes(total)
    return total
  }
})
