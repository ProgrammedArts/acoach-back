module.exports = {
  settings: {
    cors: {
      enabled: true,
    },
    parser: {
      enabled: true,
      multipart: true,
      includeUnparsed: true,
    },
    gzip: {
      enabled: true,
      options: {
        br: false,
      },
    },
  },
}
