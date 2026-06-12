App({
  globalData: {
    gameMinutes: 0,
    userInfo: null,
    familyId: null,
    isLoggedIn: false,
    cloudReady: false
  },

  onLaunch: function () {
    // 先加载本地数据，确保应用能正常启动
    this.loadLocalData()
    
    // 异步初始化云开发，不阻塞启动
    this.initCloud()
  },

  initCloud: function () {
    if (!wx.cloud) {
      console.log('当前基础库不支持云能力，使用本地模式')
      return
    }

    try {
      wx.cloud.init({
        env: 'cloud1-d0gnc8vm2aae15ae5',
        traceUser: true
      })
      this.globalData.cloudReady = true
      console.log('云开发初始化成功')
      
      // 云开发初始化成功后，异步检查登录状态
      this.checkLoginStatusAsync()
    } catch (e) {
      console.log('云开发初始化失败，使用本地模式:', e.message)
      this.globalData.cloudReady = false
    }
  },

  loadLocalData: function () {
    try {
      var gameMinutes = wx.getStorageSync('gameMinutes')
      if (gameMinutes !== '') {
        this.globalData.gameMinutes = gameMinutes
      }
      var userInfo = wx.getStorageSync('userInfo')
      if (userInfo) {
        this.globalData.userInfo = JSON.parse(userInfo)
        this.globalData.isLoggedIn = true
      }
      var familyId = wx.getStorageSync('familyId')
      if (familyId) {
        this.globalData.familyId = familyId
      }
    } catch (e) {
      console.error('读取本地数据失败', e)
    }
  },

  saveUserInfo: function (userInfo) {
    this.globalData.userInfo = userInfo
    this.globalData.isLoggedIn = true
    try {
      wx.setStorageSync('userInfo', JSON.stringify(userInfo))
    } catch (e) {
      console.error('保存用户信息失败', e)
    }
  },

  saveFamilyId: function (familyId) {
    this.globalData.familyId = familyId
    try {
      wx.setStorageSync('familyId', familyId)
    } catch (e) {
      console.error('保存家庭ID失败', e)
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
  },

  // 异步检查登录状态，带超时处理
  checkLoginStatusAsync: function () {
    var that = this
    
    // 设置超时，5秒后放弃等待
    var timeoutId = setTimeout(function () {
      console.log('云函数登录超时，使用本地数据')
    }, 5000)

    wx.cloud.callFunction({
      name: 'login',
      timeout: 5000,
      success: function (res) {
        clearTimeout(timeoutId)
        if (res.result && res.result.success && res.result.userInfo) {
          that.saveUserInfo(res.result.userInfo)
          console.log('云函数登录成功')
        } else {
          console.log('用户未在云端注册，使用本地数据')
        }
      },
      fail: function (err) {
        clearTimeout(timeoutId)
        console.log('云函数调用失败:', err.errMsg || '未知错误')
        // 失败时继续使用本地数据，不影响应用运行
      }
    })
  },

  // 手动调用云函数（带超时和错误处理）
  callCloudFunction: function (name, data, callback) {
    if (!this.globalData.cloudReady) {
      callback({ success: false, message: '云开发未初始化' })
      return
    }

    wx.cloud.callFunction({
      name: name,
      data: data,
      timeout: 10000,
      success: function (res) {
        callback(res.result)
      },
      fail: function (err) {
        console.log('云函数 ' + name + ' 调用失败:', err.errMsg)
        callback({ success: false, message: err.errMsg || '调用失败' })
      }
    })
  },

  logout: function () {
    this.globalData.userInfo = null
    this.globalData.isLoggedIn = false
    this.globalData.familyId = null
    try {
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('familyId')
    } catch (e) {
      console.error('退出登录失败', e)
    }
  }
})