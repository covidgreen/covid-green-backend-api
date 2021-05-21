const AWS = require('aws-sdk')
const fp = require('fastify-plugin')

/**
 * Allows users to fetch various files out of S3. Most are relatively static files, and are self explanatory.
 * These endpoints are only active in a non-production build of the API.
 */
async function data(server, options, done) {
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  })

  const cache = new Map()

  const fetchItem = async (item, response) => {
    if (item.includes('..')) {
      throw new Error('Invalid path')
    }

    let result = cache.get(item)

    if (!result) {
      const object = {
        Bucket: options.aws.assetsBucket,
        Key: item
      }

      result = await s3.getObject(object).promise()

      server.log.info({ item }, 'populating cache')
      cache.set(item, result)

      setTimeout(() => {
        server.log.info({ item }, 'clearing cache')
        cache.delete(item)
      }, 600000)
    }

    response.headers({
      'Content-Length': result.ContentLength,
      'Content-Type': result.ContentType
    })

    response.send(result.Body)
  }

  server.route({
    method: 'GET',
    url: '/settings',
    handler: async (request, response) => {
      return fetchItem('settings.json', response)
    }
  })

  server.route({
    method: 'GET',
    url: '/settings/exposures',
    handler: async (request, response) => {
      request.authenticate()

      if (request.query.os === 'ios') {
        return fetchItem('exposures-ios.json', response)
      } else {
        return fetchItem('exposures.json', response)
      }
    }
  })

  server.route({
    method: 'GET',
    url: '/settings/language',
    handler: async (request, response) => {
      return fetchItem('language.json', response)
    }
  })

  server.route({
    method: 'GET',
    url: '/stats',
    handler: async (request, response) => {
      request.authenticate()

      return fetchItem('stats.json', response)
    }
  })

  server.route({
    method: 'GET',
    url: '/data/exposures/*',
    handler: async (request, response) => {
      request.authenticate()

      return fetchItem(`exposures/${request.params['*']}`, response)
    }
  })

  done()
}

module.exports = fp(data)
