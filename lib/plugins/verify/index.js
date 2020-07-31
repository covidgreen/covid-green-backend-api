const fetch = require('node-fetch')
const fp = require('fastify-plugin')
const jwt = require('jsonwebtoken')
const SQL = require('@nearform/sql')
const { pki } = require('node-forge')
const { v4: uuidv4 } = require('uuid')
const { BadRequest } = require('http-errors')
const { JWS } = require('node-jose')
const { differenceInMinutes } = require('date-fns')

async function verify(server, options) {
  server.decorateRequest('verify', async function(nonce) {
    const {
      deviceVerificationPayload,
      platform,
      timestamp = Date.now()
    } = this.body
    const { deviceVerification, isProduction } = options

    if (platform === 'test') {
      try {
        const { id } = server.jwt.verify(deviceVerificationPayload)
        const query = SQL`SELECT id FROM tokens WHERE id = ${id} AND type = 'register'`
        const { rowCount } = await server.pg.read.query(query)

        if (rowCount === 0) {
          throw new Error('Invalid token')
        }
      } catch (err) {
        this.log.error(
          { deviceVerificationPayload, err },
          'error validating with registration token'
        )
        throw new BadRequest('Invalid verification')
      }
    } else if (platform === 'android') {
      try {
        const { header, payload } = await JWS.createVerify().verify(
          deviceVerificationPayload,
          {
            allowEmbeddedKey: true
          }
        )

        const data = JSON.parse(payload)
        const ca = pki.createCaStore([
          pki.certificateFromPem(options.deviceVerification.safetyNetRootCa)
        ])

        const chain = header.x5c.map(cert => {
          return pki.certificateFromPem(
            `-----BEGIN CERTIFICATE-----${cert}-----END CERTIFICATE-----`
          )
        })

        if (
          pki.verifyCertificateChain(ca, chain) === false ||
          chain[0].subject.getField('CN').value !== 'attest.android.com' ||
          data.nonce !== nonce ||
          (deviceVerification.apkPackageName &&
            data.apkPackageName !== deviceVerification.apkPackageName) ||
          (deviceVerification.apkDigestSha256 &&
            data.apkDigestSha256 !== deviceVerification.apkDigestSha256) ||
          (deviceVerification.apkCertificateDigestSha256 &&
            JSON.stringify(data.apkCertificateDigestSha256) !==
              JSON.stringify(deviceVerification.apkCertificateDigestSha256))
        ) {
          this.log.error({ data }, 'invalid attestation data')
          throw new Error('Invalid attestation')
        }
      } catch (err) {
        this.log.error(
          { deviceVerificationPayload, err },
          'error validating with SafetyNet'
        )
        throw new BadRequest('Invalid verification')
      }
    } else if (platform === 'ios') {
      try {
        const host = isProduction
          ? 'api.devicecheck.apple.com'
          : 'api.development.devicecheck.apple.com'

        const token = jwt.sign({}, deviceVerification.key, {
          algorithm: 'ES256',
          keyid: deviceVerification.keyId,
          issuer: deviceVerification.teamId
        })

        const serverTimestamp = Date.now()

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
              timestamp: serverTimestamp
            })
          }
        )

        if (response.status === 400 && response.statusText === 'Bad Request') {
          const timeDifferenceInMinutes = Math.abs(
            differenceInMinutes(serverTimestamp, timestamp)
          )
          if (
            timeDifferenceInMinutes >
            deviceVerification.timeDifferenceThresholdMins
          ) {
            throw new Error('Invalid timestamp')
          }
        }

        if (response.status !== 200) {
          throw new Error(await response.text())
        }
      } catch (err) {
        this.log.error(
          { deviceVerificationPayload, err },
          'error validating with DeviceCheck'
        )

        const message =
          err.message === 'Invalid timestamp'
            ? 'Invalid timestamp'
            : 'Invalid verification'

        throw new BadRequest(message)
      }
    } else {
      this.log.error('no verification method provided')
      throw new BadRequest('Invalid verification')
    }
  })
}

module.exports = fp(verify)
