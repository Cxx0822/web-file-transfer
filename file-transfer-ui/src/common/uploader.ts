import { UploadFile } from './uploadFile'

import { IUploaderFileInfo, IUploaderOptions, IUploaderUserOptions, STATUS } from '@/types'
import { MyEvent } from './myEvent'
import { mergeFile } from '@/api/uploadService.ts'
import { UploadFileQueue } from '@/common/UploadFileQueue.ts'
import { generateUniqueIdentifier } from '@//utils'
import { ElMessage } from 'element-plus'

/**
 * 上传器类
 */
export class Uploader extends MyEvent {
  // 上传器配置项
  uploaderOptions: IUploaderOptions
  // 上传文件唯一标识列表
  uploadFileUniqueIdentifierList: string[]
  // 上传文件列表
  uploadFileQueue: UploadFileQueue<UploadFile>
  // 上传异常文件列表(上传错误 暂停上传等)
  errorUploadFileQueue: UploadFileQueue<UploadFile>
  // 当前上传文件
  currentUploadFile: UploadFile
  // 新选择的文件
  newUploadFile: UploadFile
  // 上传文件消息
  uploadFileMessage: string
  // 是否正在上传文件
  hasUploadingFile: boolean

  constructor(options: IUploaderUserOptions) {
    super()
    // 合并默认值配置和自定义配置
    this.uploaderOptions = Object.assign(optionsDefaults, options)
    this.eventData = {}
    this.uploadFileUniqueIdentifierList = []
    // 上传文件列表
    this.uploadFileQueue = new UploadFileQueue()
    this.errorUploadFileQueue = new UploadFileQueue()
    // @ts-ignore
    this.currentUploadFile = null
    // @ts-ignore
    this.newUploadFile = null
    this.uploadFileMessage = ''
    this.hasUploadingFile = false
  }

  /**
   * Assign a browse action to one or more DOM nodes.
   * @function
   * @param {Element|Array.<Element>} domNode
   * @param {boolean} isDirectory Pass in true to allow directories to
   * @param {boolean} singleFile prevent multi file upload
   *  http://www.w3.org/TR/html-markup/input.file.html#input.file-attributes
   *  eg: accept: 'image/*'
   * be selected (Chrome only).
   */
  assignBrowse(domNode: HTMLElement, isDirectory: boolean, singleFile: boolean) {
    let inputElement: HTMLElement

    // 如果是Input类型
    if (domNode.tagName === 'INPUT') {
      inputElement = domNode
    } else {
      // 如果不是input类型 则创建input元素
      inputElement = document.createElement('input')
      inputElement.setAttribute('type', 'file')
      // 支持多选文件
      inputElement.setAttribute('multiple', 'multiple')
      inputElement.style.visibility = 'hidden'
      inputElement.style.position = 'absolute'
      inputElement.style.width = '1px'
      inputElement.style.height = '1px'

      domNode.appendChild(inputElement)
    }

    if (!this.uploaderOptions.isSingleFile && !singleFile) {
      inputElement.setAttribute('multiple', 'multiple')
    }

    if (isDirectory) {
      inputElement.setAttribute('webkitdirectory', 'webkitdirectory')
    }

    // attributes && common.each(attributes, function(value, key) {
    //   input.setAttribute(key, value)
    // })

    // 监听选择文件事件
    inputElement.addEventListener('change', async (event: Event) => {
      const htmlInputElement = event.target as HTMLInputElement

      // 如果选择了文件 则将其加入到上传文件列表中
      if (htmlInputElement.value && htmlInputElement.files !== null) {
        // 首先将文件添加至上传列表中
        await this.addUploadFiles(htmlInputElement.files)

        // 如果需要自动上传并且当前没有正在上传的文件 则开始上传
        if (!this.hasUploadingFile
          && this.uploaderOptions.isAutoStart
          && this.uploadFileQueue.getAll().length > 0) {
          this.startUploadFile()
        }

        htmlInputElement.value = ''
      }
    }, false)
  }

  /**
   * 增加上传文件
   * @param fileList 文件列表
   */
  async addUploadFiles(fileList: FileList) {
    const fileListArray = Array.from(fileList)

    // 不能在foreach等带返回值的遍历语法中使用异步！
    // foreach等都是同步的 用普通的for循环即可
    for (let i = 0; i < fileListArray.length; i++) {
      // 生成UploadFile对象
      this.newUploadFile = new UploadFile(fileListArray[i], this.uploaderOptions)

      // 预处理上传文件
      await this.preprocessUploadFile(fileListArray[i])
        .then(() => {
          // 文件校验
          if (this.checkUploadFile(fileListArray[i])) {
            // 判断文件是否在上传中
            if (this.checkIsUniqueIdentifier()) {
              // 添加至文件唯一标识列表中
              this.uploadFileUniqueIdentifierList.push(this.newUploadFile.uniqueIdentifier)
              // 添加至队列中
              this.insertUploadFileQueue()
              this.triggerUploadFileEvent('onUploaderProgress', this.newUploadFile, '文件添加至上传队列中')
            } else {
              // 文件在上传列表中 触发文件已经在上传列表中事件
              // this.triggerUploadFileEvent('onFileSuccess', this.newUploadFile, '文件已经在上传列表中')
              ElMessage.error(`${this.newUploadFile.name}文件已经在上传列表中`)
            }
          } else {
            // 文件校验失败  此时也要触发文件增加事件
            this.trigger('onFileAdd', this.getUploaderFileInfo(this.newUploadFile))
            this.triggerUploadFileEvent('onFileFailed', this.newUploadFile, this.uploadFileMessage)
          }
        })
        .catch(() => {
          this.uploadFileMessage = '预处理错误'
          this.triggerUploadFileEvent('onFileFailed', this.newUploadFile, this.uploadFileMessage)
        })
    }
  }

  /**
   * 开始上传文件块
   */
  startUploadFile() {
    this.hasUploadingFile = true
    // 获取当前上传的文件
    this.currentUploadFile = this.getCurrentUploadFile()
    this.currentUploadFile.state = STATUS.PROGRESS
    this.triggerUploadFileEvent('onUploaderProgress', this.currentUploadFile, '准备上传文件')

    // 判断是否需要跳过上传 即服务器是否存在文件
    this.currentUploadFile.checkSkipUploadFile()
      .then((response) => {
        const { chunkResult } = response.data
        if (chunkResult.skipUpload) {
          this.triggerUploadFileEvent('onFileSuccess', this.currentUploadFile, '文件已经存在服务器中')
        } else {
          this.triggerUploadFileEvent('onUploaderProgress', this.currentUploadFile, '上传文件块中')
          // 上传文件块 uploadedChunkList为已经上传过的文件块个数
          // 该参数为实现续传的关键
          this.uploadChunkInfo(chunkResult.uploadedChunkList.length)
        }
      })
      .catch(() => {
        this.triggerUploadFileEvent('onFileFailed', this.currentUploadFile, '服务器连接错误')
      })
  }

  /**
   * 暂停文件上传
   * @param uploadFileInfo 上传文件
   */
  pauseUpload(uploadFileInfo: IUploaderFileInfo) {
    // 1.找到上传文件的索引值
    const index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)
    // 2.暂停上传
    this.uploadFileQueue.getAll()[index].pauseUploadFile()
    // 3.添加至上传异常队列 从上传文件列中删除
    this.errorUploadFileQueue.insertQueue(this.uploadFileQueue.getAll()[index])
    this.uploadFileQueue.deleteQueue()
    // 4.继续上传下一个
    this.uploadNextFile()
  }

  /**
   * 恢复文件上传
   * @param uploadFileInfo 上传文件
   */
  resumeUpload(uploadFileInfo: IUploaderFileInfo) {
    // 1.找到上传异常文件的索引值
    const index = this.getErrorUploadFileIndex(uploadFileInfo.uniqueIdentifier)
    // 2.添加至待上传文件列表 从上传异常队列中删除
    this.uploadFileQueue.insertQueue(this.errorUploadFileQueue.getAll()[index])
    this.errorUploadFileQueue.getAll().splice(index, 1)
    // 3.判断是否还有文件正在上传 如果没有 则恢复上传
    if (!this.hasUploadingFile) {
      this.uploadNextFile()
    }
  }

  /**
   * 取消文件上传
   * @param uploadFileInfo 上传文件
   */
  cancelUpload(uploadFileInfo: IUploaderFileInfo) {
    let index: number
    switch (uploadFileInfo.state) {
      case STATUS.PENDING:
        // 1.如果处于等待上传 则从上传队列中删除
        index = this.getUploadFileIndex(uploadFileInfo.uniqueIdentifier)
        this.uploadFileQueue.item = this.uploadFileQueue.getAll().splice(index, 1)
        break
      case STATUS.ABORT:
      case STATUS.ERROR:
        // 1.如果是暂停上传或上传出错 则从上传异常队列中删除
        index = this.getErrorUploadFileIndex(uploadFileInfo.uniqueIdentifier)
        this.errorUploadFileQueue.item = this.errorUploadFileQueue.getAll().splice(index, 1)
        break
      default:
        break
    }

    // 2.找到文件唯一标识列表中的索引 并删除该上传文件
    const uniqueIdentifierIndex = this.uploadFileUniqueIdentifierList.findIndex((item) => {
      return item === uploadFileInfo.uniqueIdentifier
    })
    this.uploadFileUniqueIdentifierList.splice(uniqueIdentifierIndex, 1)
  }

  /**
   * 删除上传文件
   * @param uploadFileInfo 上传文件
   */
  deleteUploadFile(uploadFileInfo: IUploaderFileInfo) {
    // 1.查找文件唯一标识列表中的索引 (只有上传成功了才可以删除)
    const index = this.uploadFileUniqueIdentifierList.findIndex((item) => {
      return item === uploadFileInfo.uniqueIdentifier
    })
    // 2.删除该唯一标识
    this.uploadFileUniqueIdentifierList.splice(index, 1)
  }

  /**
   * 将上传文件添加至队列中
   */
  private insertUploadFileQueue() {
    // 插入队列
    this.uploadFileQueue.insertQueue(this.newUploadFile)

    // 队尾元素即刚插入的上传文件  绑定监听事件
    this.uploadFileQueue.tail().on('onFileProgress', () => {
      // 触发上传器上传中事件
      this.trigger('onUploaderProgress', this.getUploaderFileInfo(this.getCurrentUploadFile()))
    })

    // 触发添加文件事件
    this.trigger('onFileAdd', this.getUploaderFileInfo(this.newUploadFile))
  }

  /**
   * 获取当前上传的文件 即队首元素
   */
  private getCurrentUploadFile() {
    return this.uploadFileQueue.peek()
  }

  /**
   * 文件上传前处理
   * @param file 需要上传的文件
   */
  private async preprocessUploadFile(file: File) {
    // 设置UploadFile的唯一标识
    const { chunkSize } = this.uploaderOptions
    this.newUploadFile.uniqueIdentifier = await generateUniqueIdentifier(file, chunkSize)
    // 设置UploadFile状态为等待开始
    this.newUploadFile.state = STATUS.PENDING
  }

  /**
   * 校验上传文件
   * @param file 文件
   */
  private checkUploadFile(file: File): boolean {
    // 如果文件大小小于0或者大于最大值 则校验失败
    if (file.size <= 0 || file.size > this.uploaderOptions.fileMaxSize) {
      this.uploadFileMessage = '文件校验失败 超出上传文件最大值'
      return false
    }

    // 获取文件名后缀
    const fileType: string = file.name.replace(/.+\./, '')
    // 可上传文件类型列表中不包含该文件类型 则校验失败
    if (this.uploaderOptions.fileTypeLimit.length !== 0) {
      const isInclude = this.uploaderOptions.fileTypeLimit.includes(fileType)
      if (!isInclude) this.uploadFileMessage = '文件校验失败 不在上传文件类型中'
      return isInclude
    } else {
      this.uploadFileMessage = '文件校验成功'
      return true
    }
  }

  /**
   * 判断文件是否在上传文件列表中
   */
  private checkIsUniqueIdentifier(): boolean {
    // 防止多次上传同一个文件
    // 如果每个文件的标识都不等于该标识 则认为该文件不在上传列表中
    return this.uploadFileUniqueIdentifierList.every((item) => {
      return item !== this.newUploadFile.uniqueIdentifier
    })
  }

  /**
   * 上传文件块
   * @param chunkLength 文件块长度
   */
  private uploadChunkInfo(chunkLength: number) {
    // 生成文件块
    this.currentUploadFile.generateChunks(chunkLength)
    // 并发上传文件块
    this.currentUploadFile.concurrentUploadFile()
      // 上传成功
      .then(() => {
        this.triggerUploadFileEvent('onUploaderProgress', this.currentUploadFile, '开始合并文件')

        // 合并文件
        this.mergeUploadFile(this.currentUploadFile)
          .then(() => {
            this.triggerUploadFileEvent('onFileSuccess', this.currentUploadFile, '上传文件成功')
          })
          .catch(() => {
            // 触发上传器上传失败事件
            this.triggerUploadFileEvent('onFileFailed', this.currentUploadFile, '合并文件错误')
          })
      })
      // 上传失败
      .catch(() => {
        this.triggerUploadFileEvent('onFileFailed', this.currentUploadFile, '上传文件块错误')
      })
  }

  /**
   * 合并上传文件
   * @param uploadFile 上传文件
   */
  private async mergeUploadFile(uploadFile: UploadFile) {
    return await mergeFile(this.uploaderOptions.serviceIp + this.uploaderOptions.mergeUrl,
      uploadFile, this.uploaderOptions.uploadFolderPath)
  }

  /**
   * 获取当前上传文件的索引值
   * @param uniqueIdentifier 文件唯一标识
   */
  private getUploadFileIndex(uniqueIdentifier: string): number {
    return this.uploadFileQueue.getAll().findIndex((item) => {
      return item.uniqueIdentifier === uniqueIdentifier
    })
  }

  /**
   * 获取上传异常文件的索引值
   * @param uniqueIdentifier 文件唯一标识
   */
  private getErrorUploadFileIndex(uniqueIdentifier: string): number {
    return this.errorUploadFileQueue.getAll().findIndex((item) => {
      return item.uniqueIdentifier === uniqueIdentifier
    })
  }

  /**
   * 获取上传文件信息
   */
  private getUploaderFileInfo(uploadFile: UploadFile): IUploaderFileInfo {
    return {
      name: uploadFile.name,
      size: uploadFile.size,
      uniqueIdentifier: uploadFile.uniqueIdentifier,
      state: uploadFile.state,
      currentProgress: uploadFile.currentProgress,
      currentSpeed: uploadFile.currentSpeed,
      timeRemaining: uploadFile.timeRemaining,
      message: this.uploadFileMessage
    }
  }

  /**
   * 触发上传文件事件
   * @param triggerType 触发类型
   * @param uploadFile 上传文件
   * @param message 消息
   */
  private triggerUploadFileEvent(triggerType: string, uploadFile: UploadFile, message: string) {
    this.uploadFileMessage = message as string

    switch (triggerType) {
      case 'onFileSuccess':
        uploadFile.state = STATUS.SUCCESS
        uploadFile.currentProgress = 100
        break
      case 'onFileFailed':
        uploadFile.state = STATUS.ERROR
        break
      default:
        break
    }

    this.trigger(triggerType, this.getUploaderFileInfo(uploadFile))

    // 一共有2个队列
    // 其中一个为待上传文件的队列 程序会一直上传该队列的队首元素，直到该队列为空
    // 每次上传成功/上传错误/暂停上传时都会出列，如果上传异常还会添加至待上传队列中

    // 另一个为暂停上传/上传错误的队列 该队列会暂时存放所有异常情况的文件，
    // 等待继续上传时，出列并添加待上传文件队列

    // 如果取消上传，则会查找2个队列 删除上传的文件

    // 无论该次上传成功或失败 都会继续上传下一个
    if (triggerType !== 'onUploaderProgress') {
      // 删除上传过的文件 即出列
      this.uploadFileQueue.deleteQueue()

      // 如果上传失败了 需要将该文件添加至上传异常队列中
      this.errorUploadFileQueue.insertQueue(uploadFile)

      this.uploadNextFile()
    }
  }

  /**
   * 上传下一个文件
   */
  private uploadNextFile() {
    // 如果当前上传队列中存在文件 则继续上传
    if (this.uploadFileQueue.size() > 0) {
      this.startUploadFile()
    } else {
      // 全部上传结束
      this.hasUploadingFile = false
    }
  }
}

const optionsDefaults: IUploaderOptions = {
  fileMaxSize: 200 * 1024 * 1024,
  chunkSize: 2 * 1024 * 1024,
  // BUG TODO 如果是并发上传 会导致计算的速度有问题 原因是this.startTime的位置有问题
  simultaneousUploads: 1,
  maxChunkRetries: 3,
  isSingleFile: true,
  successCode: [20000],
  fileTypeLimit: [],
  isAutoStart: true,
  serviceIp: '',
  uploadUrl: '',
  mergeUrl: '',
  uploadFolderPath: '',
  fileParameterName: '',
  headers: {}
}
