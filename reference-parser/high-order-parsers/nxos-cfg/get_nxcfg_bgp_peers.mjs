// uncomment the import below for production, as well as the export at the bottom


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
	flattenItem,
  filterArray,

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

	// from Parser_Network.mjs
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

	// from classIPv4.mjs
	IPv4,
	RoutingTable,
	ASN,
  ifNotFound,


} from '../parser_modules.mjs'

/* Where I'm at:

0) Look at the return value - it's not even returning 

1) documentation has been updated

2) .logEnv() added to bgpNeighborRecord parser, but it's not working right:
   The line after 'neighbor 10.61.250.49 remote-as 64513' has "BADLINE" added, and it's not being caught.
   Need to find out why .logEnv is not working.
*/


/*********************************************************************************
 * Module:      get_nxcfg_bgp_peers
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: Parses all BGP content for a single NXOS device
 * Caveats:     ?
 * Output:      normalized dataSet of bgpPeer objects:
 *	bgpPeerResolved: {
 *		"source-ip",
 *		"peer-ip",
 *		"peer-as",
 *		"local-as",
 *		"local-as-flags,"
 *		"description",
 *		"timers",
 *		"route-map-in",
 *		"route-map-out",
 *		"has-bfd",
 *		"has-send-community",
 *		"has-next-hop-self",
 *		"is-admindown",
 *		"member-of",
 * 		"assoc-interface": { interfaceRecord },
 * 		"transit_subnet",
 *	}
 */

const get_nxcfg_bgp_peers = (deviceName) => {

	const pmodule = {
		name: 'get_nxcfg_bgp_peers',
		ver: 1.0
	}
		
	const _0 = (arr) => arr[0]
	const _1 = (arr) => arr[1]
	const _2 = (arr) => arr[2]
	const _3 = (arr) => arr[3]
	const isTrue = (res) => true
		
	// common tokens
	const asplain = digits
	const asdot = sequenceOf(digits, '.', digits)
	const asn = oneOf(asplain, asdot)
	const vrfName = regex(/^[a-zA-Z0-9_-]+/)
	const routeMapName = regex(/^[a-zA-Z0-9_-]+/)
	const timerSeconds = digits

	// raw line parsers for nxos bgp
	const af_ipv4_unicast 		= parseLine( 'address-family', 'ipv4', 'unicast' ).map((res)=>true)
	const af_other 						= parseLine( 'address-family', hword, rol ).map( joinWith(':') )
			
	// vrf lines
	const vrfHeader						= parseLine( 'vrf', vrfName ).map( _1 )
	const routerID						= parseLine( 'router-id', ipUC ).map( _1 )
	const logNeighborChanges 	= parseLine( 'log-neighbor-changes' ).map( isTrue )
			
	// vrf->address-family ipv4 lines
	const network							= parseLine( 'network', ipNetwork, at_eol).map( _1 )
	const network_plus				= parseLine( 'network', ipNetwork, rol)
		.logResult(`[${pmodule.name}]:network_plus: information after network statement`)
			
	// neighbor lines
	const neighborHeader 			= parseLine( 'neighbor', ipUC.tag('peerIP'), 'remote-as', asn.tag('peerAS') )
	const localAs							= parseLine( 'local-as', asn, rol ).map( ([_0, asn, flags=``]) => ({localAs:asn, localAS_flags:flags }) )
	const removePrivateAS			= parseLine( 'remove-private-as').map( isTrue )
	const description					= parseLine( 'description', rol ).map( _1 )
	const isShutdown					= parseLine( 'shutdown' ).map( isTrue )
	const timers 							= parseLine( 'timers', timerSeconds, timerSeconds ).map( ([_,_1,_2])=>`${_1}:${_2}` )
			
	// neighbor->address-family ipv4 lines
	const sendCommunity				= parseLine( 'send-community', at_eol).map( isTrue )
	const sendCommunityExt		= parseLine( 'send-community extended', at_eol).map( isTrue )
	const nextHopSelf					= parseLine( 'next-hop-self').map( isTrue ) 
	const routeMapIn					= parseLine( 'route-map', routeMapName, 'in' ).map( _1 )
	const routeMapOut					= parseLine( 'route-map', routeMapName, 'out' ).map( _1 )
	const peer_password				= parseLine( 'password', rol).map(isTrue)
	
	// wildcard line-items
	const unknown 							= parseLine(rol).map( _0 )

	
	/** multi-level record parsers **/

	const bgpNeighborRecord = until(endOfIndentLevel, sequenceOf(
		neighborHeader,	
		setOf(
			localAs.tag('localAS'),
			removePrivateAS.tag('removePrivateAS'),
			description.tag('desc'),
			isShutdown.tag('is_shutdown'),
			timers.tag('timers'),
			peer_password.tag('peer_passwd'),
			until(endOfIndentLevel, sequenceOf(
				af_ipv4_unicast,
				setOf(
					sendCommunity.tag('sendCommunity'),
					sendCommunityExt.tag('sendCommunityExt'),
					routeMapIn.tag('routeMap_in'),
					routeMapOut.tag('routeMap_out'),	
					nextHopSelf.tag('nextHopSelf'),
					unknown.tag('UNK_bgpPeer')
						.logResult(`[${pmodule.name}]:'bgpNeighborRecord': unknown information after network statement`)
				)		// setOf
			))  // until
	//    .logEnv( ({
	//      section_index_start,
	//      section_index_parseduntil,
	//      section_index_terminatation,
	//      section_text,
	//      section_text_parsed,
	//      section_text_unparsed,
	//      section_parser_dataLog,
	//      dataLog,
	//    }) => ([
	//    	//section_parser_datalog,
	//    	dataLog,
	//      (section_text_unparsed?.length > 0) ? [
	//    	  `[module:${pmodule.name}, parser:bgpNeighbor_record]: skipped section text between ${section_index_parseduntil} and ${section_index_terminatation}`,
	//    	  `Unparsed text: "${section_text_unparsed}"`
	//      ] : []
	//    ]))  // logEnv
		)  // setOf
	)).named('bgpNeighborRecord')  
		
	
	const bgpVrf_entries = 	setOf(
		routerID.tag('routerID'),
		logNeighborChanges.tag('logNeighChanges'),
		until(endOfIndentLevel, sequenceOf(
			af_ipv4_unicast,
			many(network).map(joinWith('|')).tag('networks')
		))
	
	).named('bgpVrf_entries')
	
	
	const bgpVrf_record = until(endOfIndentLevel, sequenceOf(
		vrfHeader.tag('vrfName'),
		setOf(
			routerID.tag('routerID'),
			logNeighborChanges.tag('logNeighChanges'),
			until(endOfIndentLevel, sequenceOf(
				af_ipv4_unicast,
				many(network).map(joinWith('|')).tag('networks')
			))
		),
		many(bgpNeighborRecord).tagList('bgpPeers')
	))  // until
	.logEnv( ({
		section_index_start,
		section_index_parseduntil,
		section_index_terminatation,
		section_text,
		section_text_parsed,
		section_text_unparsed,
		section_parser_dataLog,
		dataLog,
	}) => {
		const returnVal = [
			dataLog,
			(section_text_unparsed?.length > 0) ? [
				`[${deviceName}: module:${pmodule.name}, parser:bgpVrf_record]: skipped section text between ${section_index_parseduntil} and ${section_index_terminatation}`,
				`Unparsed text: "${section_text_unparsed}"`
			] : []
		]
		return returnVal
	})  // logEnv
	
	.named('bgpVrf_record')
	//.getTagged()
	//.map(multiplyBy('bgpPeers'))
	
	
	const bgpMain_header 					= parseLine( 'router bgp', asn ).map( _1 )

	// NOTE: This specific 'setOf' is temperamental, because I can't put a wildcard in it.  That's because it's not inside a bounded parser
	// collect individual prop items used in bgpMainRecord
	const bgpMain_entries = many( 
		// NOTE: having 'except' turns bgpMain_entries into a bounded_parser, allowing us to use a wildcard 'unknown' parser below
		except(oneOf(
			// NOTE: these define the end of the section - they return a success when it, 
			// which forces except to return fail, which causes our 'many' to stop processing
			regex(/^\s*vrf /),						// vrf will stop bgpMain parsing
			regex(/^\s*\n/),							// blank line will stop bgpMain parsing
			regex(/^\s*logging/),					// logging will stop bgpMain parsing
		).named('nxos_bgpMain_entries_terminators'), oneOf(
			af_ipv4_unicast.tag('af'),
			parseLine('more stuff').map( _0 ).tag('morestuff'),
			parseLine('stuff').map( _0 ).tag('somestuff'),
			unknown.logResult( (res) => `${deviceName}: [${pmodule.name}, parser:bgpMain_entries]: unrecognized text '${res}'`)
		).named('bgpMain_entries')  // oneOf
		) // except
	).named('bgpMain_entries')
	
	
	const bgpMain_record = sequenceOf(
	//	hostnameFromConfig							.tagAs('deviceName'),
		gotoSection('router bgp'),
		bgpMain_header.tag('deviceASN'),
		bgpMain_entries.tag('bgpMain'),
		many(bgpVrf_record).tagList('vrfs')
	).named(pmodule.name)
	.getTaggedR()
	.map(multiplyBy('vrfs'))					// <-- after this, we have an array, so next multiply is a mapArray
	.map(mapArray(multiplyBy('bgpPeers')))
	.map(flattenArray)
	.map(mapArray(flattenItem))
	
	
	const nxosBGP =  sequenceOf(
		bgpMain_record.tag('globalBGP'),
		many(bgpVrf_record).tagList('vrfs'),
	).getTaggedR()
	
	
	
		const normalizedASN = (asn = '') => asn.includes('.') ? `${(ASN.from_asDot(asn).error || ASN.from_asDot(asn).asn)}` : asn
	
	
		const formatColumns = ({
			vrfName,
			peerIP,
			deviceASN,
			peerAS,
			localAS,
			localAS_flags,
			is_ebgpMultihop = ``,
			peer_passwd = false,
			removePrivateAS,
			bgpVrfProps = `nyi*`,
			rd = ``,			// currently none of our TORCs should have a route-distinguisher configured, as it's for MPLS
			routeMap_in,
			routeMap_out,
			sendCommunity,
			sendCommunityExt,
			desc,
			timers,
			af,
			routerID,
			nextHopSelf,
			is_shutdown,
			logNeighChanges,
			UNK_bgpPeer,
			...skipped
		}) => ({
			deviceName,
			vrfName,
			peerIP,
			peerType: (deviceASN == peerAS) ? 'iBGP' : 'eBGP',
			adminDown: (is_shutdown) ? true : false,
			deviceASN,
			peerAS,
			localAS,
			localAS_flags,
			is_ebgpMultihop,
			routeMap_in,
			routeMap_out,
			has_sendCommunity: (sendCommunity && sendCommunityExt) ? true : false,
			routerID,
			rd,
			desc,
			deviceASN_asplain: normalizedASN(deviceASN),
			peerAS_asplain: normalizedASN(peerAS),
			localAS_asplain: normalizedASN(localAS),
			hasPassword: (peer_passwd==true) ? true : false,
			nextHopSelf,
			removePrivateAS,
			bgpVrfProps,
			_key_: `${deviceName}:${vrfName}:${peerIP}`,
			skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
		})
	
	
		return bgpMain_record
			.map( mapArray(({
				networks,
				...bgpPeerRecord
			}) => ({
				...bgpPeerRecord
			})))	
			.map(mapArray(formatColumns))
			.map(filterArray((bgpPeer) => bgpPeer?.peerIP != null && bgpPeer?.peerIP?.length != 0))
	
}

// comment this out when using in production
// get_nxcfg_bgp_peers('test_device_name')
	
// comment this out when using in-browser IDE
export { get_nxcfg_bgp_peers }

	