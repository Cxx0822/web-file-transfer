import { File } from 'buffer'

export interface EventDataIF {
    [key: string]: Function
}

export interface UploaderOptionsIF {
    // 文件块大小
    chunkSize?: number
    // 同时上传的文件块个数
    simultaneousUploads?: number
    // 是否是单文件模式
    singleFile?: boolean
    fileParameterName?: string
    progressCallbacksInterval?: number
    speedSmoothingFactor?: number
    query?: {}
    headers?: {}
    withCredentials?: boolean
    preprocess?: Function
    method?: string
    testMethod?: string
    uploadMethod?: string
    prioritizeFirstAndLastChunk?: boolean
    allowDuplicateUploads?: boolean
    target?: string
    testChunks?: boolean
    generateUniqueIdentifier?: (file: File)=>{}
    maxChunkRetries?: number
    chunkRetryInterval?: null
    permanentErrors?: number[]
    successStatuses?: number[]
    onDropStopPropagation?: boolean
    initFileFn?: null
    checkChunkUploadedByResponse?: null
    // 自动下载
    autoStart?: boolean
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