var app = getApp()
var wikiUtil = require('../../utils/wiki.js')

// 语音识别：微信同声传译插件（需在小程序后台「插件管理」添加并通过）
var recordManager = null
var voiceAvailable = false
try {
  var plugin = requirePlugin('WechatSI')
  recordManager = plugin.getRecordRecognitionManager()
  voiceAvailable = true
} catch (e) {
  voiceAvailable = false
}

Page({
  data: {
    title: '',
    rawText: '',      // 口述/输入的原始内容
    content: '',      // AI 整理后的内容（保存这个）
    isPublic: false,
    voiceAvailable: voiceAvailable,
    recording: false,
    organizing: false,
    saving: false
  },

  onLoad: function () {
    var that = this
    if (!voiceAvailable || !recordManager) return
    recordManager.onStart = function () { that.setData({ recording: true }) }
    recordManager.onRecognize = function (res) {
      if (res && res.result) that.setData({ rawText: (that._base || '') + res.result })
    }
    recordManager.onStop = function (res) {
      var text = (that._base || '') + ((res && res.result) || '')
      that.setData({ recording: false, rawText: text })
    }
    recordManager.onError = function () {
      that.setData({ recording: false })
      wx.showToast({ title: '没听清，可直接打字', icon: 'none' })
    }
  },

  onTitleInput: function (e) { this.setData({ title: e.detail.value }) },
  onRawInput: function (e) { this.setData({ rawText: e.detail.value }) },
  onContentInput: function (e) { this.setData({ content: e.detail.value }) },
  onTogglePublic: function (e) { this.setData({ isPublic: e.detail.value }) },

  // 按住说话
  onVoiceStart: function () {
    if (!voiceAvailable || !recordManager) {
      wx.showToast({ title: '未启用语音，请打字', icon: 'none' })
      return
    }
    this._base = this.data.rawText ? (this.data.rawText + ' ') : ''
    recordManager.start({ lang: 'zh_CN', duration: 60000 })
  },
  onVoiceEnd: function () {
    if (voiceAvailable && recordManager && this.data.recording) recordManager.stop()
  },

  // AI 整理
  onOrganize: function () {
    var that = this
    var raw = (this.data.rawText || '').trim()
    if (!raw) { wx.showToast({ title: '先说点或打点内容', icon: 'none' }); return }
    this.setData({ organizing: true })
    wikiUtil.organizeNote(raw).then(function (text) {
      that.setData({ organizing: false, content: (text || '').trim() })
      wx.showToast({ title: '已整理，可修改', icon: 'success' })
    }).catch(function (err) {
      // AI 不可用时退回原文
      that.setData({ organizing: false, content: raw })
      wx.showModal({ title: 'AI 整理失败', content: (err && err.message) || '已用原文，可手动编辑', showCancel: false })
    })
  },

  onSave: function () {
    var that = this
    var content = (this.data.content || this.data.rawText || '').trim()
    if (!content) { wx.showToast({ title: '内容不能为空', icon: 'none' }); return }
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再保存', icon: 'none' }); return }
    this.setData({ saving: true })
    app.callCloudFunction('saveWiki', {
      title: (this.data.title || '').trim(),
      content: content,
      isPublic: this.data.isPublic
    }, function (res) {
      that.setData({ saving: false })
      if (res && res.success) {
        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(function () { wx.navigateBack() }, 1000)
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
      }
    })
  }
})
