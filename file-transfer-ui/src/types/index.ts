export interface EventDataIF {
    [key: string]: Function
}

export interface UploaderUserOptionsIF {
    // 文件块大小
    chunkSize: number
    // 同时上传的文件块个数
    simultaneousUploads?: number
    // 是否是单文件模式
    singleFile?: boolean
    // 后端数据MultipartFile字段的名称
    fileParameterName: string
    // 自定义请求头
    headers?: {}
    // 上传文件块url
    uploadUrl: string,
    // 合并文件url
    mergeUrl: string,
    // 文件上传地址
    uploadFolderPath: string
    // 文件唯一标识方法
    generateUniqueIdentifier?: (file: File)=>string
    // 最大重试上传次数
    maxChunkRetries?: number
    // 自定义响应成功状态码
    successCode?: number[]
    // 是否自动下载
    autoStart?: boolean
}

export interface UploaderDefaultOptionsIF {
    // 文件块大小
    chunkSize: number
    // 同时上传的文件块个数
    simultaneousUploads: number
    // 是否是单文件模式
    singleFile: boolean
    // 后端数据MultipartFile字段的名称
    fileParameterName: string
    // 自定义请求头
    headers: {}
    // 上传文件块url
    uploadUrl: string,
    // 合并文件url
    mergeUrl: string,
    // 文件上传地址
    uploadFolderPath: string
    // 文件唯一标识方法
    generateUniqueIdentifier?: (file: File)=>string
    // 最大重试上传次数
    maxChunkRetries: number
    // 自定义响应成功状态码
    successCode: number[]
    // 是否自动下载
    autoStart: boolean
}

export interface FileParamIF {
    chunkNumber: number,
    chunkSize?: number,
    currentChunkSize?: number,
    totalSize: number,
    identifier: string,
    filename: string,
    fileType: string
    relativePath: string,
    totalChunks: number,
}