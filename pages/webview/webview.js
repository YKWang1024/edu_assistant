Page({
  data: {
    url: '',
    loading: true,
    error: ''
  },

  onLoad: function (options) {
    var that = this
    if (options.url) {
      var decodedUrl = decodeURIComponent(options.url)
      this.setData({ url: decodedUrl })

      setTimeout(function () {
        if (that.data.loading) {
          that.setData({ 
            loading: false, 
            error: '链接加载超时，请检查网络或稍后重试' 
          })
        }
      }, 10000)
    }
  },

  onWebViewLoad: function () {
    this.setData({ loading: false, error: '' })
  },

  onWebViewError: function (e) {
    console.error('web-view 加载错误:', e)
    this.setData({ 
      loading: false, 
      error: '链接无法打开，请复制链接到浏览器访问' 
    })
  },

  onRetry: function () {
    this.setData({ loading: true, error: '' })
    this.setData({ url: '' })
    setTimeout(() => {
      this.setData({ url: this.data.url })
    }, 100)
  },

  onCopyLink: function () {
    wx.setClipboardData({
      data: this.data.url,
      success: function () {
        wx.showToast({ title: '已复制链接', icon: 'none' })
      }
    })
  },

  onShareAppMessage: function () {
    return {
      title: '查看参考教程',
      path: '/pages/webview/webview?url=' + encodeURIComponent(this.data.url)
    }
  }
})