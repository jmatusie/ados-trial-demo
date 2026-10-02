
/**  Comment out this import and export at bottom when using in browser sandbox     */
import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	intf_classifyBy,
	normalizedDataSet,
	is,

	// from Parser_Core.mjs
	Parser,
	seqOf,
	sequenceOf,
	regex,
	oneOf,
	many,
	possibly,
	lookAhead,
	setOf,
	succeedWith,
	everythingUntil,
	except,
	strng,
	many1,
	coroutine,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	word,
	eol,
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	interfaceName,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,

	// from Parser_FlexParsers.mjs
	gotoStr,
	until,
	untilStr,
	goto,

	// from Parser_ResultHelpers.mjs
	flattenItem,
	nullToArray,
	nullToStr,
	filterArray,
	multiplyBy_v2,
	ifNotFound,

	// from classIPv4.mjs
	IPv4,
	RoutingTable,
} from '../parser_modules.mjs'


import {
	get_eoscfg_acls_extended,
	get_eoscfg_acls_standard,
	get_eoscfg_acls,
} from '../eos-cfg/get_eoscfg_acls.mjs'

import {
	rollupComments,
} from './get_acls.mjs'


import {
	get_eoscfg_nat_pools
} from '../eos-cfg/get_eoscfg_nat_pools.mjs'


import {
	get_eoscfg_nats
} from '../eos-cfg/get_eoscfg_nats.mjs'


const get_natFlows_prev = (deviceName, deviceOS) => coroutine(function* () {
	const dataLog = []

	const pmodule = {
		name: 'get_natFlows',			// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}

	const rawNats =
		(deviceOS == 'EOS') ? yield possibly(lookAhead(get_eoscfg_nats(deviceName))).map(nullToArray)
			: null

	// early exit if wrong OS
	if (rawNats == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}

	// early exit if no NATs found
	if (rawNats.length == 0) {
		dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-5-EMPTY: no nat configurations found`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}

	//const eoscfg_acls_extended = yield possibly(lookAhead(get_eoscfg_acls_extended(deviceName))).map(nullToArray).map(rollupComments)
	//const eoscfg_acls_standard = yield possibly(lookAhead(get_eoscfg_acls_standard(deviceName))).map(nullToArray).map(rollupComments)
	
	const eoscfg_acls = yield possibly(lookAhead(get_eoscfg_acls(deviceName))).map(nullToArray).map(rollupComments)
	const {standard=[], extended=[]} = Object.groupBy(eoscfg_acls, (item)=>item.aclType)
	
	
	const eoscfg_nat_pools = yield possibly(lookAhead(get_eoscfg_nat_pools(deviceName))).map(nullToArray)

	const extAclLookup = Map.groupBy(eoscfg_acls_extended, (aclRecord) => aclRecord.aclName)
	const stdAclLookup = Map.groupBy(eoscfg_acls_standard, (aclRecord) => aclRecord.aclName)
	const aclLookup = Map.groupBy(eoscfg_acls, (aclRecord) => aclRecord.aclName)
	const natPoolLookup = Map.groupBy(eoscfg_nat_pools, (natPoolRecord) => natPoolRecord.poolName)

	// For each nat statement, lookup the ACL entry & add as 'aclEntries' property
	// the secondary function of this .map operation is to identify configuration errors w/regards to matching references to pools & ACLs to their existence
	const augmentedNats = rawNats.map(({ natAcl, pool, natType, interfaceName, intfIP, ...natEntry }, idx) => {
		const errorTags = []

		// flags the existence of reference errors to both acls & nat pools
		const natAcl_isReferenced = natAcl?.length > 0
		const natAcl_hasReferenceError = natAcl_isReferenced && (extAclLookup.has(natAcl) === false && stdAclLookup.has(natAcl) === false)
		const natPool_isReferenced = pool?.length > 0
		const natPool_hasReferenceError = pool && (natPoolLookup.has(pool) === false)

		const natPoolIP = (pool == 'overload') ? intfIP
			: (natPool_isReferenced == false) ? ``
				: natPool_hasReferenceError ? `**CFGERR**`
					: natPoolLookup.get(pool)[0].natPoolAddr

		const aclEntries = (natAcl_isReferenced == false) ? []
			: natAcl_hasReferenceError ? []
				: aclLookup.get(natAcl)


		/**** ERROR CHECKING *****/
		if (stdAclLookup.has(natAcl)) {
			errorTags.push(`CFG-4-STD_ACL_USED`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-4-STD_ACL_USED: interface ${interfaceName}: using a standard ACL '${natAcl}' instead of an extended ACL. Entries are used as a source network`)
		}

		if (natAcl_hasReferenceError) {				// missing 'ip access-list natAcl' statement
			errorTags.push(`CFG-3-NO_NAT_ACL_DEFINED`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-3-NO_NAT_ACL_DEFINED: interface ${interfaceName}: referencing ACL ${natAcl}, but no matching ACL exists`)
		}

		if (natPool_hasReferenceError && pool !== 'overload') {		// missing 'ip nat pool <natpool>' statement
			errorTags.push(`CFG-3-NO_NATPOOL_DEFINED`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-3-NO_NATPOOL_DEFINED: interface ${interfaceName}: referencing nat pool ${pool}, but no matching pool exists`)
		}

		const returnVal = {
			natAcl,
			pool,
			natType,
			interfaceName,
			intfIP,
			...natEntry,
			natPoolIP,
			aclEntries,
			error: `${errorTags.join(',')}`
		}

		return returnVal
	})

	const returnVal = augmentedNats.flatMap(multiplyBy('aclEntries'))

	const formatColumns = ({
		deviceName,
		interfaceName,
		intfIP,
		vrf,
		isShut,
		intfDesc,
		natType,
		aclEntries,
		pool,
		natPoolIP,
		error,
		ip1,
		ip1_port,
		natAcl,
		ip2,
		ip2_port,
		aclName,
		aclType,
		action,
		seqNo,
		proto,
		net,   // srcNet used if extended ACL was used, net is used if standard ACL was used
		srcNet,
		srcPorts,
		dstNet,
		dstPorts,
		remark,
		flags,
		_key_,
		skippedCols,
		...skipped
	}) => {
		const returnVal = {
			deviceName,
			deviceOS,
			nat_intf: interfaceName,
			nat_intf_is_shut: isShut,
			nat_type: natType,
			custIP_orig: (natType == 'SRC_DYN') ? (srcNet ?? net) : (natType == 'DST_STAT') ? ip2 : (natType == 'SRC_STAT') ? `${ip1}` : 'error',
			custIP_xlated: (natType == 'SRC_DYN') ? natPoolIP : (natType == 'DST_STAT') ? (ip1 ?? '0.0.0.0/0') : (natType == 'SRC_STAT') ? `${ip2}` : 'error',
			remoteIP: (natType == 'SRC_DYN') ? (dstNet ?? '0.0.0.0/0') : (natType == 'DST_STAT') ? (srcNet ?? '0.0.0.0/0') : (natType == 'SRC_STAT') ? (dstNet ?? '0.0.0.0/0') : 'error',
			nat_intf_vrf: vrf,
			nat_intf_ip: intfIP,
			nat_acl_name: (natAcl == null) ? '' : natAcl,
			acl_src_net: (srcNet ?? net),		// NOTE: srcNet used if extended ACL was used, net is used if standard ACL was used
			acl_dst_net: dstNet,
			nat_intf_desc: intfDesc,
			natpool_name: pool,
			natpool_ip: natPoolIP,
			nat_ip1: ip1,
			nat_ip2: ip2,
			error,
			acl_type: aclType,
			acl_action: action,
			acl_seqNo: seqNo,
			acl_proto: proto,
			acl_remark: remark ? `${remark } (be cautious about considering this acl remark accurate)` : '',
			skippedCols_prev: skippedCols,
			skippedEntries: Object.keys(skipped)?.join(',') ?? ''
		}
		return returnVal
	}

	// add local error messages to the system so they get logged as errors
	yield Parser.of(null).insertLogs(dataLog)
	return returnVal.map(formatColumns)
})


const get_natFlows = (deviceName, deviceOS) => coroutine(function* () {
	const dataLog = []

	const pmodule = {
		name: 'get_natFlows',			// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}

	const rawNats =
		(deviceOS == 'EOS') ? yield possibly(lookAhead(get_eoscfg_nats(deviceName))).map(nullToArray)
			: null

	// early exit if wrong OS
	if (rawNats == null) {
		dataLog.push(`[${pmodule.name}]: The supplied OS ${deviceOS} is not handled by this module.`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}

	// early exit if no NATs found
	if (rawNats.length == 0) {
		dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-5-EMPTY: no nat configurations found`)
		yield Parser.of(null).insertLogs(dataLog)
		return []
	}

	//const eoscfg_acls_extended = yield possibly(lookAhead(get_eoscfg_acls_extended(deviceName))).map(nullToArray).map(rollupComments)
	//const eoscfg_acls_standard = yield possibly(lookAhead(get_eoscfg_acls_standard(deviceName))).map(nullToArray).map(rollupComments)
	const eoscfg_acls = yield possibly(lookAhead(get_eoscfg_acls(deviceName))).map(nullToArray).map(rollupComments)
	
	
	//const eoscfg_acls_grouped = Object.groupBy(eoscfg_acls, (item)=>item.aclType)
	const {standard=[], extended=[]} = Object.groupBy(eoscfg_acls, (item)=>item.aclType)
	const eoscfg_acls_extended = standard
	const eoscfg_acls_standard = extended

	const eoscfg_nat_pools = yield possibly(lookAhead(get_eoscfg_nat_pools(deviceName))).map(nullToArray)

	const extAclLookup = Map.groupBy(eoscfg_acls_extended, (aclRecord) => aclRecord.aclName)
	const stdAclLookup = Map.groupBy(eoscfg_acls_standard, (aclRecord) => aclRecord.aclName)
	const aclLookup = Map.groupBy(eoscfg_acls, (aclRecord) => aclRecord.aclName)
	const natPoolLookup = Map.groupBy(eoscfg_nat_pools, (natPoolRecord) => natPoolRecord.poolName)

	// For each nat statement, lookup the ACL entry & add as 'aclEntries' property
	// the secondary function of this .map operation is to identify configuration errors w/regards to matching references to pools & ACLs to their existence
	const augmentedNats = rawNats.map(({ natAcl, pool, natType, interfaceName, intfIP, ...natEntry }, idx) => {
		const errorTags = []

		// flags the existence of reference errors to both acls & nat pools
		const natAcl_isReferenced = natAcl?.length > 0
		const natAcl_hasReferenceError = natAcl_isReferenced && (extAclLookup.has(natAcl) === false && stdAclLookup.has(natAcl) === false)
		const natPool_isReferenced = pool?.length > 0
		const natPool_hasReferenceError = pool && (natPoolLookup.has(pool) === false)

		const natPoolIP = (pool == 'overload') ? intfIP
			: (natPool_isReferenced == false) ? ``
				: natPool_hasReferenceError ? `**CFGERR**`
					: natPoolLookup.get(pool)[0].natPoolAddr

		const aclEntries = (natAcl_isReferenced == false) ? []
			: natAcl_hasReferenceError ? []
				: aclLookup.get(natAcl)


		/**** ERROR CHECKING *****/
		if (stdAclLookup.has(natAcl)) {
			errorTags.push(`CFG-4-STD_ACL_USED`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-4-STD_ACL_USED: interface ${interfaceName}: using a standard ACL '${natAcl}' instead of an extended ACL. Entries are used as a source network`)
		}

		if (natAcl_hasReferenceError) {				// missing 'ip access-list natAcl' statement
			errorTags.push(`CFG-3-NO_NAT_ACL_DEFINED`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-3-NO_NAT_ACL_DEFINED: interface ${interfaceName}: referencing ACL ${natAcl}, but no matching ACL exists`)
		}

		if (natPool_hasReferenceError && pool !== 'overload') {		// missing 'ip nat pool <natpool>' statement
			errorTags.push(`CFG-3-NO_NATPOOL_DEFINED`)
			dataLog.push(`[${deviceName} ${pmodule.name}]: CFG-3-NO_NATPOOL_DEFINED: interface ${interfaceName}: referencing nat pool ${pool}, but no matching pool exists`)
		}

		const returnVal = {
			natAcl,
			pool,
			natType,
			interfaceName,
			intfIP,
			...natEntry,
			natPoolIP,
			aclEntries,
			error: `${errorTags.join(',')}`
		}

		return returnVal
	})

	const returnVal = augmentedNats.flatMap(multiplyBy('aclEntries'))

	const formatColumns = ({
		deviceName,
		interfaceName,
		intfIP,
		vrf,
		isShut,
		intfDesc,
		natType,
		aclEntries,
		pool,
		natPoolIP,
		error,
		ip1,
		ip1_port,
		natAcl,
		ip2,
		ip2_port,
		aclName,
		aclType,
		action,
		seqNo,
		proto,
		net,   // srcNet used if extended ACL was used, net is used if standard ACL was used
		srcNet,
		srcPorts,
		dstNet,
		dstPorts,
		remark,
		flags,
		_key_,
		skippedCols,
		...skipped
	}) => {
		const returnVal = {
			deviceName,
			deviceOS,
			nat_intf: interfaceName,
			nat_intf_is_shut: isShut,
			nat_type: natType,
			custIP_orig: (natType == 'SRC_DYN') ? (srcNet ?? net) : (natType == 'DST_STAT') ? ip2 : (natType == 'SRC_STAT') ? `${ip1}` : 'error',
			custIP_xlated: (natType == 'SRC_DYN') ? natPoolIP : (natType == 'DST_STAT') ? (ip1 ?? '0.0.0.0/0') : (natType == 'SRC_STAT') ? `${ip2}` : 'error',
			remoteIP: (natType == 'SRC_DYN') ? (dstNet ?? '0.0.0.0/0') : (natType == 'DST_STAT') ? (srcNet ?? '0.0.0.0/0') : (natType == 'SRC_STAT') ? (dstNet ?? '0.0.0.0/0') : 'error',
			nat_intf_vrf: vrf,
			nat_intf_ip: intfIP,
			nat_acl_name: (natAcl == null) ? '' : natAcl,
			acl_src_net: (srcNet ?? net),		// NOTE: srcNet used if extended ACL was used, net is used if standard ACL was used
			acl_dst_net: dstNet,
			nat_intf_desc: intfDesc,
			natpool_name: pool,
			natpool_ip: natPoolIP,
			nat_ip1: ip1,
			nat_ip2: ip2,
			error,
			acl_type: aclType,
			acl_action: action,
			acl_seqNo: seqNo,
			acl_proto: proto,
			acl_remark: remark ? `${remark } (be cautious about considering this acl remark accurate!)` : '',
			skippedCols_prev: skippedCols,
			skippedEntries: Object.keys(skipped)?.join(',') ?? ''
		}
		return returnVal
	}

	// add local error messages to the system so they get logged as errors
	yield Parser.of(null).insertLogs(dataLog)
	return returnVal.map(formatColumns)
})



export {
	get_natFlows
}