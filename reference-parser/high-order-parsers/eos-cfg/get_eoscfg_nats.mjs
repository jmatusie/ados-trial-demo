//iFRd1u5pm19r9f_a23mKsw

/** TODO: formatColumns */

/**  Comment out this import and export at bottom when using in browser sandbox     */

import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	multiplyBy_v2_lossy,
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
	find,

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


const get_eoscfg_nats = (deviceName) => {
	const pmodule = {
		name: 'get_eoscfg_nats',			// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									  // future capability
		usage: '',							  	// future capability to provide help (may not be used)
	}

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

		.map(multiplyBy_v2_lossy('entries'))  // will return an empty array if nothing found in 'entries' prop
		.map(mapArray(formatColumns))

} // get_eoscfg_nats


export {
	get_eoscfg_nats
} 