const fetch = require('node-fetch')
const fp = require('fastify-plugin')
const jwt = require('jsonwebtoken')
const SQL = require('@nearform/sql')
const { v4: uuidv4 } = require('uuid')
const { BadRequest } = require('http-errors')
const { JWS } = require('node-jose')

async function verify(server, options) {
  server.decorateRequest('verify', async function(nonce) {
    const { deviceVerificationPayload, platform } = this.body

    if (platform === 'test') {
      try {
        const { id } = server.jwt.verify(deviceVerificationPayload)
        const query = SQL`SELECT id FROM tokens WHERE id = ${id} AND type = 'register'`
        const { rowCount } = await server.pg.read.query(query)

        if (rowCount === 0) {
          throw new Error('Invalid token')
        }
      } catch (error) {
        this.log.error(error, 'error validating with registration token')
        throw new BadRequest('Invalid verification')
      }
    } else if (platform === 'android') {
      try {
        const { key, payload } = await JWS.createVerify().verify(
          deviceVerificationPayload,
          {
            allowEmbeddedKey: true
          }
        )

        if (key.kid !== 'attest.android.com') {
          throw new Error('Attestation from untrusted source')
        }

        const data = JSON.parse(payload)

        if (
          data.nonce !== nonce ||
          data.apkPackageName !== options.deviceVerification.apkPackageName
        ) {
          this.log.error(data, 'invalid attestation data')
          throw new Error('Invalid attestation')
        }
      } catch (error) {
        this.log.error(error, 'error validating with SafetyNet')
        throw new BadRequest('Invalid verification')
      }
    } else if (platform === 'ios') {
      try {
        const host = options.isProduction
          ? 'api.devicecheck.apple.com'
          : 'api.development.devicecheck.apple.com'

        const token = jwt.sign({}, options.deviceVerification.key, {
          algorithm: 'ES256',
          keyid: options.deviceVerification.keyId,
          issuer: options.deviceVerification.teamId
        })

        const response = await fetch(
          `https://${host}/v1/validate_device_token`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `application/json`
            },
            body: JSON.stringify({
              device_token: deviceVerificationPayload.replace(
                /\r\n|\n|\r/gm,
                ''
              ),
              transaction_id: uuidv4(),
              timestamp: Date.now()
            })
          }
        )

        if (response.status !== 200) {
          throw new Error(await response.text())
        }
      } catch (error) {
        this.log.error(error, 'error validating with DeviceCheck')
        throw new BadRequest('Invalid verification')
      }
    } else {
      this.log.error('no verification method provided')
      throw new BadRequest('Invalid verification')
    }
  })
}

module.exports = fp(verify)
