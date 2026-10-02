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
	multiplyBy_v2,
	nullToArray,
	nullToStr,
	normalizedDataSet,

	// from Parser_Core.mjs
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

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	eol,
	tok,
	word,
	nbsp,			// consume one or more spaces and/or tabs
	_,				// 0 or more consequtive inline whitespace (spaces & tabs)
	__,				// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	interfaceName,
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,

	// from unknown
	groupByPropName,
} from '../parser_modules.mjs'



// uncomment these out when used in browser
// get_eoscfg_static_routes('test_device_name')



const nullToValue = (result) => (value) => (result === null) ? value : result


const get_eoscfg_static_routes = (deviceName) => {
	const pmodule = {
		name: 'get_eoscfg_static_routes',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}


	const vrfName = hword
	const staticRoute_name = seqOf( 'name', hword ).map((res)=>res[1])
	const staticRoute_tag = seqOf( 'tag', hword ).map((res)=>res[1])
	const staticRoute_track = seqOf( 'track bfd' ).map(((res)=>true))
	const staticRoute_adminDistance = digits

	
	const nextHop = oneOf(
		ipAddress.tag('nextHop_address'),
		seqOf(interfaceName.tag('nextHop_intf_name'), possibly(ipAddress).map(nullToStr).tag('nextHop_address'))
	)

	const restOfEntry = oneOf(
		staticRoute_track.tag('isTracked'),
		staticRoute_tag.tag('routeTag'),
		staticRoute_name.tag('name'),
		staticRoute_adminDistance.tag('adminDistance')
	)

	const ipRoute_def = parseLine(
		'ip route', 
		ipNetwork.tag('prefix'),
		nextHop,
		many(restOfEntry),
		succeedWith('default').tag('vrfName')
	).getTaggedR()


	const ipRoute_vrf = parseLine(
		'ip route vrf', vrfName.tag('vrfName'),
		ipNetwork.tag('prefix'),
		nextHop,
		many(restOfEntry),
	).getTaggedR()


	const ipRoute = oneOf(
		ipRoute_def,
		ipRoute_vrf,
	)


	const formatColumns = ({
		prefix,
		nextHop_address,
		nextHop_intf_name,
		routeTag,
		name,
		isTracked,
		adminDistance,
		vrfName,
		...skipped
	}) => ({
		deviceName,
		prefix,
		vrfName,
		nextHop_address,
		nextHop_intf_name,
		name,
		routeTag,
		isTracked,
		adminDistance,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})



	return sequenceOf(
		gotoSection('ip route'),
		many(ipRoute),//.tagList('staticRoutes')
	).map((res)=>res[1])
		.map(mapArray(formatColumns))

}

get_eoscfg_static_routes('fakeDevicename')



// comment export out when using in-browser
export {
	get_eoscfg_static_routes,
}
