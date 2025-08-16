function challengeSha256 (message) {
    if (window.crypto && window.crypto.subtle) {
        try {
            const msgBuffer = new TextEncoder().encode(message)
            return crypto.subtle.digest('SHA-256', msgBuffer)
                .then(hashBuffer => {
                    const hashArray = Array.from(new Uint8Array(hashBuffer))
                    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
                    return hashHex
                })
                .catch(error => {
                    console.warn('Web Crypto API failed, falling back to djb2 hash:', error)
                    return challengeDjb2Hash(message)
                })
        } catch (error) {
            console.warn('Web Crypto API not available, using djb2 hash:', error)
            return Promise.resolve(challengeDjb2Hash(message))
        }
    } else {

        return Promise.resolve(challengeDjb2Hash(message))
    }
}

/**
 * Стабильная функция хеширования DJB2, которая даст одинаковый результат везде
 * @param {string} str - Строка для хеширования
 * @returns {string} - Хеш в hex формате
 */
function challengeDjb2Hash (str) {
    let hash = 5381
    const input = typeof str === 'string' ? str : String(str)

    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i)
        hash = hash & 0xFFFFFFFF // Приводим к 32-битному числу
    }

    // Конвертируем в положительное число и затем в hex
    const positiveHash = Math.abs(hash)
    return positiveHash.toString(16).padStart(8, '0')
}


/**
 * Adds mathematical Challenge
 */
function challengeSolveMathChallenge (problem) {
    if (!problem) return null

    // A simple mathematical task that is difficult to solve a script
    let result = problem.seed
    for (let i = 0; i < problem.iterations; i++) {
        result = (result * problem.multiplier + problem.addend) % problem.modulus
    }
    return result
}

(function () {
    let scriptLoaded = false

    const challengeData = __CHALLENGE_DATA___
    const cookieName = '__COOKIE__'

    function fpLoadFingerprintJS () {
        if (scriptLoaded) return
        scriptLoaded = true

        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@4/dist/fp.min.js'
        script.async = true
        document.head.appendChild(script)
        script.onload = () => {
            fpInitFingerprintJS()
        }
    }

    function fpInitFingerprintJS () {
        const fpPromise = window.FingerprintJS.load()
        fpPromise
            .then(fp => fp.get())
            .then(result => {
                const visitorId = result.visitorId
                return fpExtractClientData(result.components)
                    .then(clientData => {
                        challengeValidateClient(visitorId, clientData)
                    })
            })
            .catch(error => {
                console.error('FingerprintJS error:', error)
                document.getElementById('errorMessage').classList.remove('d-none')
                document.getElementById('status').textContent = 'Verification failed'
            })
    }

    function fpExtractClientData (components) {
        // Extract data from FingerprintJS components and add additional browser information
        const data = {}

        // Basic browser data
        data.userAgent = navigator.userAgent
        data.language = navigator.language || navigator.userLanguage
        data.languages = navigator.languages || [data.language]
        data.platform = navigator.platform
        data.cookiesEnabled = navigator.cookieEnabled

        // Screen data
        data.screenResolution = {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth
        }

        // Timezone offset
        data.timezone = new Date().getTimezoneOffset()

        // Data from FingerprintJS components
        if (components) {
            const canvas = components.canvas
            if (canvas && canvas.value) {
                data.canvasFingerprint = canvas.value

                // #TODO for testing
                delete data.canvasFingerprint.geometry
                delete data.canvasFingerprint.text
            }

            const webgl = components.webgl
            if (webgl && webgl.value) {
                data.webglVendor = webgl.value.vendor
                data.webglRenderer = webgl.value.renderer
            }

            const plugins = components.plugins
            if (plugins && plugins.value) {
                data.plugins = plugins.value
            }

            const fonts = components.fonts
            if (fonts && fonts.value) {
                data.fonts = fonts.value
            }
        }

        // Additional security checks
        data.webdriver = !!window.navigator.webdriver
        data.extensions = fpGetInstalledExtensions()

        // Add unfakeable browser evidence
        data.browserProofs = fpGenerateUnfakeableProofs(challengeData)

        // Add timestamp to the proofs for freshness validation
        data.browserProofs.timestamp = Date.now()

        // Temporary label for checking the generation speed
        data.proofGenerationTime = performance.now()

        // Ensure browser proofs have a timestamp
        if (data.browserProofs && !data.browserProofs.timestamp) {
            data.browserProofs.timestamp = Date.now()
        }

        // Ensure we have challenge binding
        if (data.browserProofs && !data.browserProofs.nonce) {
            data.browserProofs.nonce = challengeData.proofSalt.substring(0, 8)
        }
    }

    function fpGetInstalledExtensions () {
        // Attempt to detect installed browser extensions
        const extensions = []

        // Check for popular extensions via their CSS or JS
        const extensionChecks = [
            { name: 'AdBlock', check: () => !!document.querySelector('script[src*="adblock"]') },
            { name: 'uBlock', check: () => !!window.uBlockOrigin },
            { name: 'Ghostery', check: () => !!window.Ghostery }
        ]

        extensionChecks.forEach(ext => {
            try {
                if (ext.check()) {
                    extensions.push(ext.name)
                }
            } catch (e) {
                // Ignore errors
            }
        })

        return extensions
    }

    function setCookie (name, value, days) {
        const date = new Date()
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
        let expires = 'expires=' + date.toUTCString()
        document.cookie = name + '=' + value + ';' + expires + ';path=/;SameSite=Lax'
    }


    function pageSubmitData (fingerprintId, data) {
        // We solve a mathematical problem
        const mathSolution = challengeSolveMathChallenge(challengeData)

        const payload = {
            fingerprint: {
                id: fingerprintId,
                data
            },
            challenge: {
                id: challengeData.id,
                solution: mathSolution,
                timestamp: Date.now()
            }
        }

        const xhr = new XMLHttpRequest()
        xhr.open('POST', '/__under_attack_challenge', true)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText)
                    if (response.success) {
                        // setCookie(cookieName, response.token, 30)
                        // window.location.reload()
                    } else {
                        document.getElementById('errorMessage').classList.remove('d-none')
                        document.getElementById('status').textContent = 'Verification failed'
                    }
                } else {
                    document.getElementById('errorMessage').classList.remove('d-none')
                    document.getElementById('status').textContent = 'Server error'
                }
            }
        }
        xhr.send(JSON.stringify(payload))
    }

    function challengeUpdateProgress (percent) {
        document.getElementById('progressBar').style.width = percent + '%'
    }

    function challengeValidateClient (fingerprint, data) {
        if (!fingerprint || !data) {
            document.getElementById('errorMessage').classList.remove('d-none')
            document.getElementById('status').textContent = 'Verification failed'
            return
        }

        challengeUpdateProgress(30)
        document.getElementById('status').textContent = 'Verifying browser...'

        setTimeout(() => {
            challengeUpdateProgress(60)
            document.getElementById('status').textContent = 'Generating security tokens...'

            setTimeout(() => {
                challengeUpdateProgress(90)
                document.getElementById('status').textContent = 'Completing verification...'

                setTimeout(() => {
                    challengeUpdateProgress(100)
                    pageSubmitData(fingerprint, data)
                }, 500)
            }, 500)
        }, 500)
    }

    window.onload = function () {
        fpLoadFingerprintJS()
    }
})()
