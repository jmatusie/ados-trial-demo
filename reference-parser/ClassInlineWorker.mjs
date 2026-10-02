/**
 * This has problem:  function 'responseHandler' below refers to function dispatch(msg), which is not in scope.  Obviously 'dispatch' was a global previously unnoticed.  Needs to be fixed somehow,
 * Preliminary ideas:
 * 
 * Add a method: setDispatcher(userFn), which sets a member "this.dispatch" to userFn.
 * UserFn handles the message.
 * 
 * The problem is that responseHandler already unpacks some of the 'raw' content (msgEvent) that comes back, and submits the rest (msg) to dispatch.
 * One woudld think that maybe responseHander itself can be 100% use-supplied, but the benefits of this class are lost.  Which benefit?  Handling
 * unresolved Promises in a queue.  
 * 
 * Work ont his later.
 */



/** InlineWorker - wrapper around Web Worker implementation, for inlined-JS
 * 
 */
class InlineWorker {
	constructor(scriptSelector) {
		this.workerBusyState = false
		this.requestID = 1						// requestID of 0 is intended to mark invalid or missing IDs
		this.unresolvedPromises = []

		//		let workerOnlyScripts = [...document.querySelectorAll('script[scope="worker"]')]//.map(scriptElem=>scriptElem.textContent).join('\n')
		let workerScript = [...document.querySelectorAll(scriptSelector)].map((scriptElem) => scriptElem.textContent).join('\n')
		this.workerBlob = new Blob([workerScript], { type: "text/javascript" })
		this.worker = new Worker(URL.createObjectURL(this.workerBlob))

		this.worker.onmessage = this.responseHandler.bind(this)
		this.worker.onerror = this.errHandler.bind(this)
		this.verboseLogging = false
		this.verboseLogging && console.log(`InlineWorker initiated using inline script ${scriptSelector}:`, this.worker)
	}



	request(requestMsg) {
		if (this.workerBusyState) return
		this.workerBusyState = true
		const id = this.requestID++
		const request = { id, ...requestMsg }

		this.unresolvedPromises[id] = {}
		this.unresolvedPromises[id].promise = new Promise((resolve, reject) => {
			this.unresolvedPromises[id].resolve = resolve
			this.unresolvedPromises[id].reject = reject
		})
		this.worker.postMessage(request)
		return this.unresolvedPromises[id].promise
	}

	responseHandler(msgEvent) {
		const msg = msgEvent.data
		this.verboseLogging && console.log(`InlineWorker:responseHandler: message received:\n, `, msg)
		const { requestID, requestCmd = '', payload = null, error = null } = msg
		this.verboseLogging && console.log(`InlineWorker:responseHandler: `, { requestID, requestCmd, payload, error })
		const result =
			(requestID) ?		// if we receive a valid reply from a previous request
				(payload) ?				// with payload
					(this.workerBusyState = false, this.unresolvedPromises[requestID].resolve(payload))
					: (error) ? 			// or with error
						(this.workerBusyState = false, this.unresolvedPromises[requestID].reject(error))
						// if request ID, with no payload, and no error - we have an invalid reply
						: this.unresolvedPromises[requestID].reject(`invalid reply from worker id: ${requestID}`)
				: (msg?.cmd && msg?.id) ?			// if not a solicited reply, but has a .cmd & .id property, this is a valid, unsolicited request - call dispatcher
					dispatch(msg)
					: this.verboseLogging && console.log(`InlineWorker:responseHandler, unsolicited message from worker thread:\n`, msg)
		this.verboseLogging && console.log(`InlineWorker:responseHandler:result `, result)
		return result
	}

	errHandler(errorEvent) {
		const errorMsg = errorEvent?.msg ?? errorEvent?.message ?? 'no error message'
		const mostRecentID = this.requestID
		this.verboseLogging && console.log('InlineWorker:errorHandler: recieved error from worker thread', {
			errorMsg,
			mostRecentID,
			promise: this.unresolvedPromises[mostRecentID],
		})
		this.unresolvedPromises[mostRecentID].reject(errorMsg)
	}
}			// class InlineWorker



export {
	InlineWorker
}