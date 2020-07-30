const AWS = require('aws-sdk')
const fp = require('fastify-plugin')

async function data(server, options, done) {
  if (!options.isProduction) {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    })

    const fetchItem = async (item, response) => {
      if (item.includes('..')) {
        throw new Error('Invalid path')
      }

      const object = {
        Bucket: options.aws.assetsBucket,
        Key: item
      }

      const result = await s3.getObject(object).promise()

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

        return fetchItem('exposures.json', response)
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
  }

  done()
}

module.exports = fp(data)
