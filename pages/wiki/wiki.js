var app = getApp()

Page({
  data: {
    list: [],
    loading: true
  },

  onShow: function () { this.loadList() },

  loadList: function () {
    var that = this
    if (!app.globalData.cloudReady) {
      that.setData({ loading: false })
      wx.showToast({ title: '请联网后查看', icon: 'none' })
      return
    }
    that.setData({ loading: true })
    app.callCloudFunction('listWiki', {}, function (res) {
      that.setData({ loading: false, list: (res && res.success) ? (res.data || []) : [] })
    })
  },

  onAdd: function () {
    wx.navigateTo({ url: '/pages/wiki/add' })
  },

  onToggleShare: function (e) {
    var that = this
    var item = e.currentTarget.dataset.item
    app.callCloudFunction('saveWiki', {
      id: item._id, title: item.title, content: item.content, isPublic: !item.isPublic
    }, function (res) {
      if (res && res.success) {
        wx.showToast({ title: item.isPublic ? '已取消分享' : '已分享到菜友圈', icon: 'success' })
        that.loadList()
      } else {
        wx.showToast({ title: (res && res.message) || '操作失败', icon: 'none' })
      }
    })
  },

  onDelete: function (e) {
    var that = this
    var id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除心得',
      content: '确定删除这条买菜心得吗？',
      confirmColor: '#ba1a1a',
      success: function (m) {
        if (!m.confirm) return
        app.callCloudFunction('deleteWiki', { id: id }, function (res) {
          if (res && res.success) { wx.showToast({ title: '已删除', icon: 'success' }); that.loadList() }
          else wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' })
        })
      }
    })
  }
})
