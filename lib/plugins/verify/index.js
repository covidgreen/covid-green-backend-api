const fetch = require('node-fetch')
const fp = require('fastify-plugin')
const jwt = require('jsonwebtoken')
const querystring = require('querystring')
const SQL = require('@nearform/sql')
// const { pki } = require('node-forge')
const { v4: uuidv4 } = require('uuid')
const { BadRequest, InternalServerError } = require('http-errors')
const { JWS } = require('node-jose')
const { differenceInMinutes } = require('date-fns')

async function verify(server, options) {
  const throwError = (code, message) => {
    const error =
      code >= 200 ? new InternalServerError(message) : new BadRequest(message)

    error.code = code

    throw error
  }

  server.decorateRequest('verify', async function (nonce) {
    const { deviceVerification, isProduction } = options
    const {
      deviceVerificationPayload,
      platform,
      timestamp = Date.now()
    } = this.body

    try {
      const serverTimestamp = Date.now()

      if (platform === 'test') {
        try {
          const { id } = server.jwt.verify(deviceVerificationPayload)
          const query = SQL`SELECT id FROM tokens WHERE id = ${id} AND type = 'register'`
          const { rowCount } = await server.pg.read.query(query)

          if (rowCount === 0) {
            throw new Error()
          }
        } catch (err) {
          throwError(101, 'Invalid token')
        }
      } else if (platform === 'android') {
        let data // ca, chain

        try {
          const { payload } = await JWS.createVerify().verify(
            deviceVerificationPayload,
            {
              allowEmbeddedKey: true
            }
          )

          data = JSON.parse(payload)

          /* chain = header.x5c.map((cert) => {
            return pki.certificateFromPem(
              `-----BEGIN CERTIFICATE-----${cert}-----END CERTIFICATE-----`
            )
          }) */
        } catch (err) {
          throwError(101, 'Invalid token')
        }

        /* try {
          ca = pki.createCaStore([
            pki.certificateFromPem(options.deviceVerification.safetyNetRootCa)
          ])
        } catch (err) {
          throwError(200, 'CA missing or invalid')
        }

        if (
          pki.verifyCertificateChain(ca, chain) === false ||
          chain[0].subject.getField('CN').value !== 'attest.android.com'
        ) {
          throwError(102, 'Could not verify certificate chain')
        } */

        if (data.nonce !== nonce) {
          throwError(103, 'Nonce does not match expected value')
        }

        if (
          deviceVerification.apkPackageName &&
          data.apkPackageName !== deviceVerification.apkPackageName
        ) {
          throwError(104, 'Package name does not match expected value')
        }

        // The apkDigestSha256 comparison check exists to ensure that the request has come from a known
        // version of the App. This check compares the hash (digest) of the APK file on the phone with the
        // APK file the system is configured to allow.
        //
        // Note that this check assumes that there is exactly 1 valid APK version in use at any single time.
        // This will prevent multiple versions of the App from being usable at any given time.
        //
        // If you'd rather support multiple versions of the app at the same time then the APK check can be
        // turned off by setting the config DEVICE_CHECK_PACKAGE_DIGEST to null.
        if (
          deviceVerification.apkDigestSha256 &&
          data.apkDigestSha256 !== deviceVerification.apkDigestSha256
        ) {
          throwError(105, 'Package hash does not match expected value')
        }

        if (
          deviceVerification.apkCertificateDigestSha256 &&
          JSON.stringify(data.apkCertificateDigestSha256) !==
            JSON.stringify(deviceVerification.apkCertificateDigestSha256)
        ) {
          throwError(
            106,
            'Package certificate hash does not match expected value'
          )
        }
      } else if (platform === 'ios') {
        let response, token

        try {
          token = jwt.sign({}, deviceVerification.key, {
            algorithm: 'ES256',
            keyid: deviceVerification.keyId,
            issuer: deviceVerification.teamId
          })
        } catch (err) {
          throwError(201, 'Credentials are missing or invalid')
        }

        try {
          if (!deviceVerification.deviceCheckDisabled) {
            const host = isProduction
              ? 'api.devicecheck.apple.com'
              : 'api.development.devicecheck.apple.com'

            response = await fetch(`https://${host}/v1/validate_device_token`, {
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
            })
          }
        } catch (err) {
          throwError(107, 'Error occurred while validating token')
        }

        if (!response.ok) {
          this.log.info({ response }, 'Device Check response is not ok')

          if (
            Math.abs(differenceInMinutes(serverTimestamp, timestamp)) >
            deviceVerification.timeDifferenceThresholdMins
          ) {
            throwError(108, 'Invalid timestamp')
          } else {
            throwError(109, 'Invalid verification token')
          }
        }
      } else if (platform === 'recaptcha') {
        try {
          const data = querystring.stringify({
            secret: deviceVerification.recaptchaSecret,
            response: deviceVerificationPayload
          })

          const url = `https://www.google.com/recaptcha/api/siteverify?${data}`
          const response = await fetch(url, { method: 'POST' })
          const result = await response.json()

          if (!result.success) {
            this.log.info({ result }, 'recaptcha response')
            throw new Error('Invalid token')
          }
        } catch (err) {
          throwError(110, 'Error occurred while validating recaptcha token')
        }
      } else {
        throwError(100, 'Unsupported verification method')
      }
    } catch (err) {
      this.log.error(
        { deviceVerificationPayload, err, platform },
        'error verifying device'
      )

      throw err
    }
  })
}

module.exports = fp(verify)
