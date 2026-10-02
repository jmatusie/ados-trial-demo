
/**  Comment out this import and export at bottom when using in browser sandbox     */
import { find } from "../../Parser_FlexParser.mjs";
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
} from './get_eoscfg_acls.mjs'




const get_eoscfg_nat_pools = (deviceName) => {
	const natPool = hword

	const natPool_header = parseLine('ip nat pool', natPool).map(result => result[1])
	const natPool_stmt = parseLine('range', ipAddress, ipAddress).map(([_, fromIP, toIP]) => {
		if (fromIP !== toIP) {
			// NOTE: this should be simple but is a bit of a mess b/c the second argument of 'IPv4.createPrefixesBetween'
			// is expected to be ONE HIGHER IP than the range (by design, like .slice(10,20) actually does 10-19.)
			// For that reason, need to take the numerical 32-bit number from toIP, add one, and use that for the second argument.
			const toIP_v2 = new IPv4(toIP)
			const rawAddr = toIP_v2.addr + 1
			const toIP_v3 = new IPv4(rawAddr)
			const range = IPv4.createPrefixesBetween(fromIP, toIP_v3).toString()
			return range
		}
		return new IPv4(fromIP).toString()
	})

	const natPoolSection = seqOf(
		natPool_header.tag('poolName'),
		natPool_stmt.tag('natPoolAddr'),
	).getTaggedR()


	const natPool_record = parseSection(natPoolSection)
	const natPool_records = many(natPool_record)

	const formatColumns = ({
		...natPoolRecord
	}) => ({
		deviceName,
		...natPoolRecord,
	})


	return seqOf(
		goto('ip nat pool'),
		natPool_records.tagList('natPools')
	).getTaggedR()
		.map(multiplyBy('natPools'))
		.map(mapArray(formatColumns))
} // end of module get_eoscfg_nat_pools



const get_eoscfg_nats = (deviceName) => {
	const acl = hword
	const natPool = hword
	const port = digits

	const aclPart = seqOf(
		'access-list',
		hword,
	).map(result => result[1])


	const ipNatStaticEntryFormat1 = seqOf(
		ipAddress.tag('ip1'),
		possibly(aclPart).tag('natAcl'),
		ipAddress.tag('ip2'),
	).getTaggedR()


	const ipNatStaticEntryFormat2 = seqOf(
		ipAddress.tag('ip1'),
		possibly(port).tag('ip1_port').map(nullToStr),
		possibly(aclPart).tag('natAcl'),
		ipAddress.tag('ip2'),
		possibly(port).tag('ip2_port').map(nullToStr),
	).getTaggedR()


	const ipNatDynamicEntryFormat1 = seqOf(
		`access-list`,
		acl.tag('natAcl'),
		'pool',
		natPool.tag('pool')
	)

	const ipNatDynamicEntryFormat2 = seqOf(
		`access-list`,
		acl.tag('natAcl'),
		strng('overload').tag('pool'),
	)

	const ipNatEntryFormatUNK = (type) => parseLine(rol).logResult((res) => `${deviceName}: [${pmodule.name}]: unrecognized ip nat statement format: '${type} ${res}'`)


	const ipNatSrcStaticEntry = parseLine(
		'ip nat source static',
		oneOf(
			ipNatStaticEntryFormat1,
			ipNatStaticEntryFormat2,
			ipNatEntryFormatUNK('ip nat source static'),
		).tag('ipNatSrcStaticEntry')
	).getTaggedR()
		.map(flattenItem)


	const ipNatDstStaticEntry = parseLine(
		'ip nat destination static',
		oneOf(
			ipNatStaticEntryFormat1,
			ipNatStaticEntryFormat2,
			ipNatEntryFormatUNK('ip nat destination static'),
		).tag('ipNatDstStaticEntry')
	).getTaggedR()
		.map(flattenItem)


	const ipNatSourceDynamicEntry = parseLine(
		'ip nat source dynamic',
		oneOf(
			ipNatDynamicEntryFormat1,
			ipNatDynamicEntryFormat2,
			ipNatEntryFormatUNK(`ip nat source dynamic`)
		).tag(`ipNatSrcDynamicEntry`)
	).getTaggedR()
		.map(flattenItem)


	const intNatStatement = oneOf(
		ipNatSourceDynamicEntry.map(addTag('natType', 'SRC_DYN')),
		ipNatDstStaticEntry.map(addTag('natType', 'DST_STAT')),
		ipNatSrcStaticEntry.map(addTag('natType', 'SRC_STAT')),
	)


	// *** Parse Interface for NAT statements & other details***

	const interfaceHeader = parseLine('interface', interfaceName).map(res => res[1])
	const interfaceDesc = parseLine('description', rol).map(res => res[1])
	const interfaceVrf = parseLine('vrf', hword).map(res => res[1])
	const interfaceIP = parseLine('ip address', ipNetwork).map(res => res[1])
	//const interfaceIsShut = gotoStr('shutdown')).map(res=>'yes')
	const interfaceIsShut = parseLine('shutdown', rol).map(res => res[0])//.map(res=>'true')

	const parseInterface = parseSection(
		sequenceOf(
			interfaceHeader.tag('interfaceName'),
			possibly(find(interfaceDesc)).map(ifNotFound('')).tag('intfDesc'),
			possibly(find(interfaceIP)).map(ifNotFound('no IP cfgd??')).tag('intfIP'),
			possibly(find(interfaceVrf)).map(ifNotFound('default')).tag('vrf'),
			possibly(find(/\n\s+shutdown/)).map(ifNotFound('no', 'yes')).tag('isShut'),
			possibly(gotoStr('ip nat')),
			many(intNatStatement).tagList('intfNatStmt')
		).getTaggedR()
			.map(multiplyBy('intfNatStmt'))
	)

	const formatColumns = ({
		...natPoolRecord
	}) => ({
		deviceName,
		...natPoolRecord,
	})


	return seqOf(
		gotoSection('interface'),
		many(parseInterface).map(flattenArray)
			.map(filterArray(item => item.natType))
			//.map(filterArray(item=>item.isShut=='no'))
			.tagList('entries')
	).getTaggedR()

		.map(multiplyBy_v2('entries'))
		.map(mapArray(formatColumns))

} // get_eoscfg_nats



const get_eoscfg_nat_flows_old = (deviceName) => coroutine(function* () {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_nat_flows',			// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}


	const dataLog = []

	const eoscfg_acls_extended = yield possibly(lookAhead(get_eoscfg_acls_extended(deviceName).map(eos_cfg_acls_rollup_byRemarks_flattened))).map(nullToArray)
	const eoscfg_acls_standard = yield possibly(lookAhead(get_eoscfg_acls_standard(deviceName).map(eos_cfg_acls_rollup_byRemarks_flattened))).map(nullToArray)

	const eoscfg_nats = yield possibly(lookAhead(get_eoscfg_nats(deviceName))).map(nullToArray)
	const eoscfg_nat_pools = yield possibly(lookAhead(get_eoscfg_nat_pools(deviceName))).map(nullToArray)

	const extAclLookup = Map.groupBy(eoscfg_acls_extended, (aclRecord) => aclRecord.aclName)
	const stdAclLookup = Map.groupBy(eoscfg_acls_standard, (aclRecord) => aclRecord.aclName)
	const natPoolLookup = Map.groupBy(eoscfg_nat_pools, (natPoolRecord) => natPoolRecord.poolName)

	// For each nat statement, lookup the ACL entry & add as 'aclEntries' property
	// the secondary function of this .map operation is to identify configuration errors w/regards to matching references to pools & ACLs to their existence
	const augmentedNats = eoscfg_nats.map(({ natAcl, pool, natType, interfaceName, intfIP, ...natEntry }, idx) => {
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
				: extAclLookup.get(natAcl) ?? stdAclLookup.get(natAcl)


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
			nat_intf_desc: interfaceName,
			natpool_name: pool,
			natpool_ip: natPoolIP,
			nat_ip1: ip1,
			nat_ip2: ip2,
			error,
			acl_type: aclType,
			acl_action: action,
			acl_seqNo: seqNo,
			acl_proto: proto,
			acl_remark: remark,
			skippedCols_prev: skippedCols,
			skippedEntries: Object.keys(skipped)?.join(',') ?? ''
		}
		return returnVal
	}

	// add local error messages to the system so they get logged as errors
	yield Parser.of(null).insertLogs(dataLog)

	return returnVal.map(formatColumns)

})


const get_eoscfg_nat_flows_new = (deviceName) => coroutine(function* () {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_nat_flows',			// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}


	const dataLog = []

	const eoscfg_acls_extended = yield possibly(lookAhead(get_eoscfg_acls_extended(deviceName))).map(nullToArray)
	const eoscfg_acls_standard = yield possibly(lookAhead(get_eoscfg_acls_standard(deviceName))).map(nullToArray)

	const eoscfg_nats = yield possibly(lookAhead(get_eoscfg_nats(deviceName))).map(nullToArray)
	const eoscfg_nat_pools = yield possibly(lookAhead(get_eoscfg_nat_pools(deviceName))).map(nullToArray)

	const extAclLookup = Map.groupBy(eoscfg_acls_extended, (aclRecord) => aclRecord.aclName)
	const stdAclLookup = Map.groupBy(eoscfg_acls_standard, (aclRecord) => aclRecord.aclName)
	const natPoolLookup = Map.groupBy(eoscfg_nat_pools, (natPoolRecord) => natPoolRecord.poolName)

	// For each nat statement, lookup the ACL entry & add as 'aclEntries' property
	// the secondary function of this .map operation is to identify configuration errors w/regards to matching references to pools & ACLs to their existence
	const augmentedNats = eoscfg_nats.map(({ natAcl, pool, natType, interfaceName, intfIP, ...natEntry }, idx) => {
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
				: extAclLookup.get(natAcl) ?? stdAclLookup.get(natAcl)


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
			nat_intf_desc: interfaceName,
			natpool_name: pool,
			natpool_ip: natPoolIP,
			nat_ip1: ip1,
			nat_ip2: ip2,
			error,
			acl_type: aclType,
			acl_action: action,
			acl_seqNo: seqNo,
			acl_proto: proto,
			acl_remark: remark,
			skippedCols_prev: skippedCols,
			skippedEntries: Object.keys(skipped)?.join(',') ?? ''
		}
		return returnVal
	}

	// add local error messages to the system so they get logged as errors
	yield Parser.of(null).insertLogs(dataLog)

	return returnVal.map(formatColumns)

})



// remove when using in production:
// get_eoscfg_nat_flows('fakedevice')

const get_eoscfg_nat_flows = get_eoscfg_nat_flows_new

export {
	get_eoscfg_nat_pools,
	get_eoscfg_nats,
	get_eoscfg_nat_flows,
}