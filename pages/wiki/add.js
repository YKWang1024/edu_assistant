var app = getApp()
var wikiUtil = require('../../utils/wiki.js')
var config = require('../../config/ai.js')

// 录音转写方案：录音 → 上传云存储 → 云函数 aiVoice 转文字（个人账号无需任何插件）
var recorderManager = wx.getRecorderManager()

Page({
  data: {
    title: '',
    rawText: '',      // 口述/输入的原始内容
    content: '',      // AI 整理后的内容（保存这个）
    isPublic: false,
    recording: false,
    transcribing: false,
    organizing: false,
    saving: false
  },

  onLoad: function () {
    var that = this
    recorderManager.onStart(function () { that.setData({ recording: true }) })
    recorderManager.onError(function () {
      that.setData({ recording: false })
      wx.showToast({ title: '录音失败，可直接打字', icon: 'none' })
    })
    recorderManager.onStop(function (res) {
      that.setData({ recording: false })
      if (res && res.tempFilePath && (res.duration || 0) > 800) {
        that.transcribe(res.tempFilePath)
      } else {
        wx.showToast({ title: '说话太短啦，再来一次', icon: 'none' })
      }
    })
  },

  onTitleInput: function (e) { this.setData({ title: e.detail.value }) },
  onRawInput: function (e) { this.setData({ rawText: e.detail.value }) },
  onContentInput: function (e) { this.setData({ content: e.detail.value }) },
  onTogglePublic: function (e) { this.setData({ isPublic: e.detail.value }) },

  // 按住说话（松开即转写）
  onVoiceStart: function () {
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再用语音', icon: 'none' }); return }
    if (this.data.transcribing) return
    this._base = this.data.rawText ? (this.data.rawText + ' ') : ''
    recorderManager.start({
      format: 'mp3',
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000
    })
  },
  onVoiceEnd: function () {
    if (this.data.recording) recorderManager.stop()
  },

  // 上传录音并调用云函数转文字
  transcribe: function (tempFilePath) {
    var that = this
    this.setData({ transcribing: true })
    var cloudPath = 'voice/' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '.mp3'
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: tempFilePath,
      success: function (up) {
        app.callCloudFunction('aiVoice', { fileID: up.fileID, language: 'zh', debug: !!config.DEBUG }, function (res) {
          that.setData({ transcribing: false })
          if (res && res.success && res.text) {
            that.setData({ rawText: (that._base || '') + res.text })
          } else {
            var m = (res && res.message) || '识别失败'
            if (config.DEBUG && res && res.error) m += '：' + res.error
            wx.showModal({ title: '语音识别失败', content: m + '（可直接打字）', showCancel: false })
          }
        }, 60000)
      },
      fail: function () {
        that.setData({ transcribing: false })
        wx.showToast({ title: '上传失败，可直接打字', icon: 'none' })
      }
    })
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
